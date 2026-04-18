"""Persona agent — user personas (Gemini Flash-Lite)."""

from __future__ import annotations

import logfire

from llm_clients import call_gemini, call_gemini_lite, call_groq, GEMINI_FLASH, GEMINI_FLASH_LITE, GROQ_LLAMA  # noqa: F401
from llm_json import strip_code_fences
from state import AgentState


def generate_personas(state: AgentState) -> tuple[str, str]:
    system = (
        "Generate 3 detailed user personas for this product. For each persona: "
        "name, role, company_size, 3 pain_points[], job_to_be_done, success_metric. "
        "Ground personas in market research if available. Return JSON only — no markdown."
    )
    ctx = state.get("research_output") or "Not yet available"
    user = f"Product goal: {state['goal']}\n\nMarket research context:\n{ctx}"

    text = call_gemini_lite(system_prompt=system, user_message=user)
    out = strip_code_fences(text).strip()
    print(f"[persona] used model: {GEMINI_FLASH_LITE}")
    return out, GEMINI_FLASH_LITE


def persona_node(state: AgentState) -> AgentState:
    text, model_used = generate_personas(state)
    state["personas"] = text
    with logfire.span("persona_agent", model_used=model_used, goal_preview=state["goal"][:100]):
        logfire.info("persona_complete")
    return state
