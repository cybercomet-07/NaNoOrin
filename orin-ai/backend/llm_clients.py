"""
Central LLM client definitions for Orin AI.
All agents import from here — never instantiate clients directly in agent files.
"""

from __future__ import annotations

import os
import random
import time

from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI

from utils.logfire_helpers import log_chat_completion_usage

load_dotenv()

# ── Gemini 2.5 Flash via OpenAI-compatible endpoint ───────────────────────────
# Used by: Supervisor, Architect, Developer, Critic (quality-critical agents)
gemini_client = OpenAI(
    api_key=os.getenv("GOOGLE_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

# ── Gemini 2.5 Flash-Lite via OpenAI-compatible endpoint ─────────────────────
# Used by: Persona, Auditor (speed-critical, low complexity agents)
gemini_lite_client = OpenAI(
    api_key=os.getenv("GOOGLE_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

# ── Groq (Llama 3.3 70B) ─────────────────────────────────────────────────────
# Used by: Researcher agent ONLY
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ── Model name constants ──────────────────────────────────────────────────────
GEMINI_FLASH = "gemini-2.5-flash-preview-05-20"
GEMINI_FLASH_LITE = "gemini-2.5-flash-lite-preview-06-17"
GROQ_LLAMA = "llama-3.3-70b-versatile"


def with_retry(func, *args, max_retries: int = 4, **kwargs):
    """
    Retries on 429 rate limit errors with exponential backoff.
    Gemini and Groq both return 429 when limits are hit.
    """
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "rate limit" in error_str or "quota" in error_str:
                wait = (2**attempt) + random.uniform(0, 1)
                print(f"[RATE LIMIT] Attempt {attempt+1}/{max_retries}. Waiting {wait:.1f}s...")
                time.sleep(wait)
                if attempt == max_retries - 1:
                    raise
            else:
                raise
    raise RuntimeError("Max retries exceeded")


def call_gemini(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    def _call():
        response = gemini_client.chat.completions.create(
            model=GEMINI_FLASH,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        log_chat_completion_usage("gemini_flash", GEMINI_FLASH, response)
        return response.choices[0].message.content or ""

    return with_retry(_call)


def call_gemini_lite(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    temperature: float = 0.3,
) -> str:
    def _call():
        response = gemini_lite_client.chat.completions.create(
            model=GEMINI_FLASH_LITE,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        log_chat_completion_usage("gemini_lite", GEMINI_FLASH_LITE, response)
        return response.choices[0].message.content or ""

    return with_retry(_call)


def call_groq(
    system_prompt: str,
    user_message: str,
    max_tokens: int = 2048,
    temperature: float = 0.2,
) -> str:
    def _call():
        response = groq_client.chat.completions.create(
            model=GROQ_LLAMA,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        log_chat_completion_usage("groq", GROQ_LLAMA, response)
        return response.choices[0].message.content or ""

    return with_retry(_call)
