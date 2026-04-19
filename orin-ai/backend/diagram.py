"""
Architecture-diagram extension.

Exposes `POST /diagram` which takes a natural-language prompt plus a Mermaid
diagram kind, calls an LLM through OpenRouter (DeepSeek primary, free-tier
fallback), and returns valid Mermaid source.

This is intentionally isolated from the main LangGraph pipeline — it is a
lightweight side-feature and must not share the Groq/TPD quota logic.
"""

from __future__ import annotations

import os
import re
from typing import Literal

import logfire
from fastapi import APIRouter, HTTPException
from openai import APIStatusError, OpenAI, RateLimitError
from pydantic import BaseModel, Field

router = APIRouter(prefix="/diagram", tags=["diagram"])

DiagramKind = Literal["flowchart", "sequence", "architecture", "er", "class", "state"]


# --------------------------------------------------------------------------- #
# Configuration                                                                 #
# --------------------------------------------------------------------------- #

_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").strip()
_PRIMARY_MODEL = os.getenv("OPENROUTER_DIAGRAM_MODEL", "deepseek/deepseek-chat-v3.1").strip()
_FALLBACK_MODEL = os.getenv(
    "OPENROUTER_DIAGRAM_MODEL_FALLBACK", "openai/gpt-oss-120b:free"
).strip()

# Tokens are small — Mermaid diagrams rarely exceed ~600 tokens even for
# large systems. Cap at 1500 so a rogue model can't blow up the response.
_MAX_TOKENS = 1500
_TEMPERATURE = 0.25

# Required by OpenRouter for attribution; harmless if not set.
_REFERRER = os.getenv("OPENROUTER_REFERRER", "http://localhost:3000")
_APP_TITLE = os.getenv("OPENROUTER_APP_TITLE", "Orin AI")


# --------------------------------------------------------------------------- #
# Prompt construction                                                           #
# --------------------------------------------------------------------------- #

_KIND_TO_MERMAID_HEADER: dict[str, str] = {
    "flowchart": "flowchart TD",
    "sequence": "sequenceDiagram",
    "architecture": "flowchart LR",
    "er": "erDiagram",
    "class": "classDiagram",
    "state": "stateDiagram-v2",
}

_KIND_TO_HINT: dict[str, str] = {
    "flowchart": (
        "A top-down flowchart of the system. Use rounded nodes for services, "
        "rectangles for components, and label every edge with a short verb "
        "describing the interaction."
    ),
    "sequence": (
        "A sequence diagram showing the main happy-path request/response flow "
        "between the primary actors and services. Include at least one Note "
        "over a participant to highlight a key decision point."
    ),
    "architecture": (
        "A left-to-right architecture diagram grouping related components into "
        "subgraphs (Frontend, Backend, Data, External). Show the data flow "
        "with directional arrows and label each connection with the protocol "
        "(HTTP, gRPC, SQL, etc) when relevant."
    ),
    "er": (
        "An Entity-Relationship diagram covering the main data entities, their "
        "key attributes (with types), and relationships (||--o{, }o--||, etc). "
        "Include primary keys where applicable."
    ),
    "class": (
        "A class diagram with the main domain classes, their key fields/methods "
        "with visibility (+/-), and inheritance/composition relationships."
    ),
    "state": (
        "A state diagram showing the lifecycle of the primary entity in the "
        "system, with [*] as entry/exit points and labeled transitions."
    ),
}


def _build_system_prompt(kind: str) -> str:
    header = _KIND_TO_MERMAID_HEADER.get(kind, "flowchart TD")
    hint = _KIND_TO_HINT.get(kind, "")
    return (
        "You are an architecture-diagram generator. "
        "You output ONLY valid Mermaid.js source code — no prose, no markdown "
        "code fences, no explanations. The first line must be a valid Mermaid "
        f"directive (e.g. `{header}`). "
        f"{hint} "
        "Keep the diagram focused and readable: aim for 6–14 nodes for small "
        "systems and no more than ~25 nodes for complex ones. Use stable, "
        "ASCII-only identifiers (letters, digits, underscores) for node IDs. "
        "Never include backticks, triple quotes, or the word 'mermaid' in the "
        "output."
    )


# --------------------------------------------------------------------------- #
# Response sanitization                                                         #
# --------------------------------------------------------------------------- #

_FENCE_RE = re.compile(r"^\s*```[a-zA-Z0-9_+-]*\s*\n|\n?```\s*$", re.MULTILINE)


def _sanitize_mermaid(text: str) -> str:
    """Strip markdown fences / leading prose the model may emit anyway."""
    if not text:
        return ""
    cleaned = _FENCE_RE.sub("", text).strip()
    lines = cleaned.splitlines()

    # Drop any leading lines that aren't part of the diagram (rare but happens
    # when the model adds a preamble despite instructions).
    valid_starts = (
        "flowchart",
        "graph",
        "sequenceDiagram",
        "classDiagram",
        "stateDiagram",
        "erDiagram",
        "journey",
        "gantt",
        "pie",
        "mindmap",
        "timeline",
        "gitGraph",
        "C4Context",
        "C4Container",
        "C4Component",
    )
    for i, line in enumerate(lines):
        if line.strip().startswith(valid_starts):
            return "\n".join(lines[i:]).strip()

    return cleaned


# --------------------------------------------------------------------------- #
# OpenRouter client                                                             #
# --------------------------------------------------------------------------- #


def _client() -> OpenAI:
    if not _API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Architecture-diagram feature is disabled: set OPENROUTER_API_KEY "
                "in backend/.env to enable it."
            ),
        )
    return OpenAI(api_key=_API_KEY, base_url=_BASE_URL)


def _call_model(model: str, system: str, user: str) -> str:
    client = _client()
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=_MAX_TOKENS,
        temperature=_TEMPERATURE,
        extra_headers={"HTTP-Referer": _REFERRER, "X-Title": _APP_TITLE},
    )
    choice = completion.choices[0] if completion.choices else None
    return (choice.message.content if choice and choice.message else "") or ""


# --------------------------------------------------------------------------- #
# Request / response models                                                     #
# --------------------------------------------------------------------------- #


class DiagramRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Describe the system you want diagrammed.",
    )
    kind: DiagramKind = Field(
        default="architecture",
        description="Mermaid diagram kind to produce.",
    )


class DiagramResponse(BaseModel):
    mermaid: str = Field(..., description="Raw Mermaid source code.")
    model: str = Field(..., description="Model that produced the diagram.")
    kind: DiagramKind
    fallback_used: bool = False


# --------------------------------------------------------------------------- #
# Route                                                                         #
# --------------------------------------------------------------------------- #


@router.post("", response_model=DiagramResponse)
async def generate_diagram(body: DiagramRequest) -> DiagramResponse:
    """Generate Mermaid source for an architecture/flow/etc diagram."""
    system = _build_system_prompt(body.kind)
    user = (
        f"System description:\n{body.prompt.strip()}\n\n"
        f"Produce a single valid Mermaid `{body.kind}` diagram. "
        f"Start on the first line with the appropriate Mermaid directive. "
        f"Return ONLY the Mermaid source."
    )

    fallback_used = False
    last_error: str | None = None

    for attempt_model in (_PRIMARY_MODEL, _FALLBACK_MODEL):
        if not attempt_model or attempt_model == _PRIMARY_MODEL and attempt_model == _FALLBACK_MODEL:
            # avoid duplicate call if both env vars point to the same model
            if attempt_model != _PRIMARY_MODEL and last_error is None:
                continue

        try:
            with logfire.span(
                "diagram_call",
                model=attempt_model,
                kind=body.kind,
                prompt_chars=len(body.prompt),
            ):
                raw = _call_model(attempt_model, system, user)
            mermaid = _sanitize_mermaid(raw)
            if not mermaid:
                last_error = "empty response from model"
                fallback_used = True
                continue

            return DiagramResponse(
                mermaid=mermaid,
                model=attempt_model,
                kind=body.kind,
                fallback_used=fallback_used,
            )
        except RateLimitError as e:
            last_error = f"rate-limited on {attempt_model}: {str(e)[:160]}"
            logfire.warn("diagram_rate_limited", model=attempt_model, error=last_error)
            fallback_used = True
            continue
        except APIStatusError as e:
            last_error = f"{attempt_model} returned {e.status_code}: {str(e)[:160]}"
            logfire.warn("diagram_api_error", model=attempt_model, error=last_error)
            fallback_used = True
            continue
        except Exception as e:  # noqa: BLE001
            last_error = f"{type(e).__name__} on {attempt_model}: {str(e)[:160]}"
            logfire.warn("diagram_unexpected_error", model=attempt_model, error=last_error)
            fallback_used = True
            continue

    raise HTTPException(
        status_code=502,
        detail=f"Diagram generation failed. Last error: {last_error or 'unknown'}",
    )
