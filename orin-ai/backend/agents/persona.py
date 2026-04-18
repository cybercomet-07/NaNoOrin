"""Persona agent — user personas (Gemini Flash-Lite)."""

from __future__ import annotations

import logfire

from llm_clients import call_agent_llm
from llm_json import strip_code_fences
from state import AgentState

_GEMINI_FLASH_LITE = "gemini-2.5-flash-lite-preview-06-17"


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
    return out, _GEMINI_FLASH_LITE, user


def persona_node(state: AgentState) -> AgentState:
    with logfire.span("persona_agent", model_used=_GEMINI_FLASH_LITE, goal_preview=state["goal"][:100]):
        text, model_used, user_message = generate_personas(state)
        state["personas"] = text
        state["messages"] = (state.get("messages", []) + [
            {"role": "user",      "content": user_message[:3000]},
            {"role": "assistant", "content": text[:3000]},
        ])[-12:]
        logfire.info("persona_complete", model_used=model_used)
    return state
