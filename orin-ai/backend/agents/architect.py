"""Architect agent — technical architecture (Groq llama-3.3-70b)."""

from __future__ import annotations

import logfire

from llm_clients import call_agent_llm
from llm_json import parse_json_object
from state import AgentState, Architecture


def fallback_architecture(goal: str) -> Architecture:
    """Non-empty spec when the LLM returns invalid JSON or empty fields — keeps Developer running."""
    g = goal[:500].replace("\n", " ").strip() or "the user request"
    return Architecture(
        docker_compose=(
            "version: '3.8'\nservices:\n  web:\n    build: .\n    ports:\n      - '8000:8000'\n"
        ),
        db_schema=(
            "from sqlalchemy.orm import DeclarativeBase\n\n"
            "class Base(DeclarativeBase):\n    pass\n"
        ),
        api_spec=(
            "openapi: 3.0.0\ninfo:\n  title: MVP API\n  version: '1.0.0'\n"
            "paths:\n  /health:\n    get:\n      summary: Health check\n"
            "      responses:\n        '200':\n          description: OK\n"
        ),
        tech_rationale=(
            "Fallback architecture: upstream JSON was missing or invalid. "
            f"Implement a minimal FastAPI app with pytest tests for: {g!r}"
        ),
    )


def generate_architecture(state: AgentState) -> tuple[Architecture, str]:
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
    text = call_agent_llm(
        "architect", system, user,
        messages_history=state.get("messages", []),
        max_tokens=2048,
        max_history_turns=2,
        max_history_content_chars=600,
    )
    data = parse_json_object(text or "")
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
    return arch, user


def architect_node(state: AgentState) -> dict:
    with logfire.span("architect_agent", goal=state["goal"][:50]):
        err_log: list[str] = []
        try:
            arch, user_message = generate_architecture(state)
        except Exception as e:
            logfire.warning("architect_using_fallback", error=str(e)[:300])
            arch = fallback_architecture(state["goal"])
            user_message = (
                f"[fallback] Architect LLM output was invalid: {str(e)[:200]}\n"
                f"Using default blueprint for goal: {state['goal'][:500]}"
            )
            err_log.append(f"architect: {type(e).__name__}: {str(e)[:400]}")
        arch_summary = f"tech_rationale: {arch.tech_rationale[:500]}"
        out: dict = {
            "architecture": arch,
            "messages": (state.get("messages", []) + [
                {"role": "user", "content": user_message[:3000]},
                {"role": "assistant", "content": arch_summary},
            ])[-12:],
        }
        if err_log:
            out["error_log"] = err_log
        return out
