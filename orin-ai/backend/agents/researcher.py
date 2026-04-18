"""Researcher agent — market intelligence (Tavily + Groq / OpenAI fallback)."""

from __future__ import annotations

import json
import os
import time

import logfire
from dotenv import load_dotenv
from groq import Groq, RateLimitError
from openai import OpenAI

from llm_json import strip_code_fences
from state import AgentState
from tools.tavily_tools import search_competitors
from utils.logfire_helpers import log_chat_completion_usage

load_dotenv()

GROQ_MODEL = "llama3-70b-8192"
OPENAI_FALLBACK_MODEL = "gpt-4o-mini"

_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def _synthesize_with_groq(system: str, user: str) -> tuple[str, object]:
    completion = _groq.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    text = completion.choices[0].message.content or ""
    log_chat_completion_usage("researcher", GROQ_MODEL, completion)
    return strip_code_fences(text).strip(), completion


def _synthesize_with_openai(system: str, user: str) -> tuple[str, object]:
    completion = _openai.chat.completions.create(
        model=OPENAI_FALLBACK_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
    )
    text = completion.choices[0].message.content or ""
    log_chat_completion_usage("researcher", OPENAI_FALLBACK_MODEL, completion)
    return strip_code_fences(text).strip(), completion


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
    try:
        text, _ = _synthesize_with_groq(system, user)
        print("[researcher] used model: groq-llama3-70b")
        return text, "groq-llama3-70b"
    except RateLimitError:
        print("[researcher] Groq rate limited; falling back to OpenAI gpt-4o-mini")
        time.sleep(2)
        text, _ = _synthesize_with_openai(system, user)
        print("[researcher] used model: gpt-4o-mini")
        return text, "gpt-4o-mini"


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
