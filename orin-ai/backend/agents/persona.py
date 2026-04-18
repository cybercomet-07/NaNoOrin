"""Persona agent — user personas (Groq / OpenAI fallback)."""

from __future__ import annotations

import os
import time

import logfire
from dotenv import load_dotenv
from groq import Groq, RateLimitError
from openai import OpenAI

from llm_json import strip_code_fences
from state import AgentState
from utils.logfire_helpers import log_chat_completion_usage

load_dotenv()

GROQ_MODEL = "llama3-70b-8192"
OPENAI_FALLBACK_MODEL = "gpt-4o-mini"

_groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
_openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))


def generate_personas(state: AgentState) -> tuple[str, str]:
    system = (
        "Generate 3 detailed user personas for this product. For each persona: "
        "name, role, company_size, 3 pain_points[], job_to_be_done, success_metric. "
        "Ground personas in market research if available. Return JSON only — no markdown."
    )
    ctx = state.get("research_output") or "Not yet available"
    user = f"Product goal: {state['goal']}\n\nMarket research context:\n{ctx}"

    def _groq() -> tuple[str, object]:
        completion = _groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
        )
        text = completion.choices[0].message.content or ""
        log_chat_completion_usage("persona", GROQ_MODEL, completion)
        return strip_code_fences(text).strip(), completion

    def _openai() -> tuple[str, object]:
        completion = _openai.chat.completions.create(
            model=OPENAI_FALLBACK_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
        )
        text = completion.choices[0].message.content or ""
        log_chat_completion_usage("persona", OPENAI_FALLBACK_MODEL, completion)
        return strip_code_fences(text).strip(), completion

    try:
        out, _ = _groq()
        print("[persona] used model: groq-llama3-70b")
        return out, "groq-llama3-70b"
    except RateLimitError:
        print("[persona] Groq rate limited; falling back to OpenAI gpt-4o-mini")
        time.sleep(2)
        out, _ = _openai()
        print("[persona] used model: gpt-4o-mini")
        return out, "gpt-4o-mini"


def persona_node(state: AgentState) -> AgentState:
    text, model_used = generate_personas(state)
    state["personas"] = text
    with logfire.span("persona_agent", model_used=model_used, goal_preview=state["goal"][:100]):
        logfire.info("persona_complete")
    return state
