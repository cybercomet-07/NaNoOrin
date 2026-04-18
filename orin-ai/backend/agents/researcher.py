"""Researcher agent — market intelligence (Tavily + Groq)."""

from __future__ import annotations

import json

import logfire

from llm_clients import call_gemini, call_gemini_lite, call_groq, GEMINI_FLASH, GEMINI_FLASH_LITE, GROQ_LLAMA  # noqa: F401
from llm_json import strip_code_fences
from state import AgentState
from tools.tavily_tools import search_competitors


def run_market_research(state: AgentState) -> tuple[str, str]:
    tavily_results = search_competitors(state["goal"])
    system = (
        "You are a market research analyst. Given raw search data, produce a structured competitor analysis."
    )
    user = (
        f"Goal: {state['goal']}\n\nRaw search data:\n{json.dumps(tavily_results)}\n\n"
        'Return JSON only with keys: competitors, pricing, gaps, market_size. '
        "No markdown fences."
    )
    text = call_groq(system_prompt=system, user_message=user)
    out = strip_code_fences(text).strip()
    print(f"[researcher] used model: {GROQ_LLAMA}")
    return out, GROQ_LLAMA


def researcher_node(state: AgentState) -> AgentState:
    text, model_used = run_market_research(state)
    state["research_output"] = text
    with logfire.span(
        "researcher_agent",
        model_used=model_used,
        goal_preview=state["goal"][:100],
    ):
        logfire.info("researcher_complete")
    return state
