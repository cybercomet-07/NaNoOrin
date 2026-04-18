"""Architect agent — technical architecture (Gemini Flash)."""

from __future__ import annotations

import logfire

from llm_clients import call_gemini, call_gemini_lite, call_groq, GEMINI_FLASH, GEMINI_FLASH_LITE, GROQ_LLAMA  # noqa: F401
from llm_json import parse_json_object
from state import AgentState, Architecture


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
    text = call_gemini(system_prompt=system, user_message=user, max_tokens=16384)
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
    with logfire.span("architect_agent", goal=state["goal"][:50], model=GEMINI_FLASH):
        state["architecture"] = generate_architecture(state)
    return state
