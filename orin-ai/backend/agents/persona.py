"""Persona agent — user personas (Groq llama-3.1-8b-instant)."""

from __future__ import annotations

import logfire

from llm_clients import GEMINI_FLASH_LITE, call_agent_llm
from llm_json import strip_code_fences
from state import DEFAULT_PERSONAS_JSON, AgentState


def generate_personas(state: AgentState) -> tuple[str, str, str]:
    system = (
        "Generate 3 detailed user personas for this product. For each persona: "
        "name, role, company_size, 3 pain_points[], job_to_be_done, success_metric. "
        "Ground personas in market research if available. Return JSON only — no markdown."
    )
    ctx = state.get("research_output") or "Not yet available"
    user = f"Product goal: {state['goal']}\n\nMarket research context:\n{ctx}"

    text = call_agent_llm("persona", system, user)
    out = strip_code_fences(text or "").strip()
    return out, GEMINI_FLASH_LITE, user


def persona_node(state: AgentState) -> dict:
    with logfire.span("persona_agent", model_used=GEMINI_FLASH_LITE, goal_preview=state["goal"][:100]):
        try:
            text, model_used, user_message = generate_personas(state)
            logfire.info("persona_complete", model_used=model_used)
            return {"personas": text}
        except Exception as e:
            logfire.warning("persona_using_default", error=str(e)[:300])
            # Partial updates only — never return full state beside Researcher (goal merge crash).
            return {
                "personas": DEFAULT_PERSONAS_JSON,
                "error_log": [f"persona: {type(e).__name__}: {str(e)[:400]}"],
            }
