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

    def _groq() -> str:
        completion = _groq.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
        )
        text = completion.choices[0].message.content or ""
        return strip_code_fences(text).strip()

    def _openai() -> str:
        completion = _openai.chat.completions.create(
            model=OPENAI_FALLBACK_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
        )
        text = completion.choices[0].message.content or ""
        return strip_code_fences(text).strip()

    try:
        out = _groq()
        print("[persona] used model: groq-llama3-70b")
        return out, "groq-llama3-70b"
    except RateLimitError:
        print("[persona] Groq rate limited; falling back to OpenAI gpt-4o-mini")
        time.sleep(2)
        out = _openai()
        print("[persona] used model: gpt-4o-mini")
        return out, "gpt-4o-mini"


def persona_node(state: AgentState) -> AgentState:
    with logfire.span("persona_agent"):
        text, model_used = generate_personas(state)
        state["personas"] = text
        logfire.info("persona_model", model_used=model_used)
    return state
