"""Architect agent — technical architecture (Claude Sonnet)."""

from __future__ import annotations

import os

import logfire
from anthropic import Anthropic
from dotenv import load_dotenv

from llm_json import parse_json_object
from state import AgentState, Architecture
from utils.logfire_helpers import log_anthropic_usage

load_dotenv()

_MODEL = "claude-sonnet-4-20250514"
_client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))


def generate_architecture(state: AgentState) -> Architecture:
    system = "You are a senior software architect. Generate a complete technical architecture as JSON."
    user = "\n\n".join(
        [
            f"Original goal:\n{state['goal']}",
            f"Competitor analysis:\n{state.get('research_output') or '(none)'}",
            f"User personas:\n{state.get('personas') or '(none)'}",
            (
                "Generate: (1) docker-compose.yml content, (2) SQLAlchemy models as Python code string, "
                "(3) OpenAPI YAML spec for all endpoints, (4) tech stack rationale. "
                "Optimize for: MVP speed, testability, security. "
                'Return JSON only with keys: docker_compose, db_schema, api_spec, tech_rationale. '
                "All values must be non-empty strings."
            ),
        ]
    )
    msg = _client.messages.create(
        model=_MODEL,
        max_tokens=16384,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    log_anthropic_usage("architect", _MODEL, msg)
    text = ""
    for block in msg.content:
        if hasattr(block, "text"):
            text += block.text

    data = parse_json_object(text)
    arch = Architecture(
        docker_compose=str(data.get("docker_compose", "")).strip(),
        db_schema=str(data.get("db_schema", "")).strip(),
        api_spec=str(data.get("api_spec", "")).strip(),
        tech_rationale=str(data.get("tech_rationale", "")).strip(),
    )
    for field_name, val in (
        ("docker_compose", arch.docker_compose),
        ("db_schema", arch.db_schema),
        ("api_spec", arch.api_spec),
        ("tech_rationale", arch.tech_rationale),
    ):
        if not val:
            raise ValueError(f"Architecture field {field_name!r} is empty or missing")
    return arch


def architect_node(state: AgentState) -> AgentState:
    with logfire.span("architect_agent", goal=state["goal"][:50]):
        state["architecture"] = generate_architecture(state)
    return state
