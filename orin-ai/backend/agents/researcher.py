# TODO: Phase 3 — Researcher Agent (Market Intelligence)
# Reference: execution_plan.md PROMPT 3.2
# Model: Groq Llama 3 70B (groq client, model "llama3-70b-8192")
# Fallback: GPT-4o-mini if Groq returns 429

import json
import logfire
from groq import Groq
from openai import OpenAI
from dotenv import load_dotenv

from state import AgentState, build_agent_context
from tools.tavily_tools import search_competitors

load_dotenv()

# TODO: initialise Groq and OpenAI clients


def run_market_research(state: AgentState) -> str:
    """
    1. Calls search_competitors() from tavily_tools with state["goal"].
    2. Sends Tavily results to Groq LLM to synthesise into structured JSON.
    3. Returns JSON string: {competitors, pricing, gaps, market_size}.
    Fallback to GPT-4o-mini on Groq RateLimitError (429).
    """
    # TODO: implement
    pass


def researcher_node(state: AgentState) -> AgentState:
    """LangGraph node — runs market research and sets research_output."""
    with logfire.span("researcher_agent",
                      model_used="groq-llama3-70b",
                      goal_preview=state["goal"][:100]):
        # TODO: call run_market_research(), set state["research_output"]
        pass
    return state
