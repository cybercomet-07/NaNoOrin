"""Researcher agent — market intelligence (Tavily + Groq llama-3.3-70b)."""

from __future__ import annotations

import json

import logfire

from llm_clients import GEMINI_FLASH, call_agent_llm
from llm_json import strip_code_fences
from state import AgentState
from tools.tavily_tools import search_competitors


def run_market_research(state: AgentState) -> tuple[str, str, str]:
    tavily_results = search_competitors(state["goal"])
    system = (
        "You are a market research analyst. Given raw search data, produce a structured competitor analysis."
    )
    user = (
        f"Goal: {state['goal']}\n\nRaw search data:\n{json.dumps(tavily_results)}\n\n"
        'Return JSON only with keys: competitors, pricing, gaps, market_size. '
        "No markdown fences."
    )
    text = call_agent_llm("researcher", system, user, max_tokens=2048, temperature=0.2)
    out = strip_code_fences(text or "").strip()
    return out, GEMINI_FLASH, user


def researcher_node(state: AgentState) -> dict:
    with logfire.span("researcher_agent", model_used=GEMINI_FLASH, goal_preview=state["goal"][:100]):
        text, model_used, user_message = run_market_research(state)
        # Return only this key — parallel Persona also runs; full-state returns duplicate `goal`
        # and trigger LangGraph InvalidUpdateError (see INVALID_CONCURRENT_GRAPH_UPDATE).
        logfire.info("researcher_complete", model_used=model_used)
    return {"research_output": text}
