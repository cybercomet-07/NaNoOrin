"""
Orin AI — Shared LLM Client  (GAP-2 / G2.1)
────────────────────────────────────────────
Single entry-point for every LLM call in the pipeline.
Agents MUST use call_agent_llm() — never instantiate Groq clients directly.

Routing (fixed):
  Agent        Key               Model
  Supervisor   GROQ_API_KEY_1    llama-3.3-70b-versatile
  Researcher   GROQ_API_KEY_1    llama-3.3-70b-versatile
  Architect    GROQ_API_KEY_2    llama-3.3-70b-versatile
  Developer    GROQ_API_KEY_3    llama-3.3-70b-versatile
  Critic       GROQ_API_KEY_3    llama-3.3-70b-versatile
  Persona      GROQ_API_KEY_4    llama-3.1-8b-instant
  Auditor      GROQ_API_KEY_4    llama-3.1-8b-instant

Message truncation (Orin plan spec):
  truncate_messages() enforces the 6-turn window before every LLM call.
"""

from __future__ import annotations

import os
import random
import time
from functools import lru_cache

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

MAX_HISTORY_TURNS = 6

# Groq model ids (public API names)
GROQ_LLAMA_70B = "llama-3.3-70b-versatile"
GROQ_LLAMA_8B_INSTANT = "llama-3.1-8b-instant"

# Aliases for agents / logfire (70b stack vs 8b instant)
GEMINI_FLASH = GROQ_LLAMA_70B  # legacy export name — same as 70B Groq
GEMINI_FLASH_LITE = GROQ_LLAMA_8B_INSTANT  # legacy export — 8b instant on Groq


def truncate_messages(
    messages: list[dict],
    max_turns: int = MAX_HISTORY_TURNS,
    content_max_chars: int | None = None,
) -> list[dict]:
    convo = [m for m in messages if m.get("role") in ("user", "assistant")]
    sliced = convo[-(max_turns * 2) :]
    if content_max_chars is None:
        return sliced
    out: list[dict] = []
    for m in sliced:
        mc = dict(m)
        c = mc.get("content", "")
        if isinstance(c, str) and len(c) > content_max_chars:
            mc["content"] = c[:content_max_chars] + "\n…[truncated]"
        out.append(mc)
    return out


@lru_cache(maxsize=16)
def _groq_client_for_env_key(env_key: str) -> Groq:
    """Lazy client — import succeeds without all keys; first use raises if key missing."""
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return Groq(api_key=api_key)


_AGENT_ENV_KEYS: dict[str, str] = {
    "supervisor": "GROQ_API_KEY_1",
    "researcher": "GROQ_API_KEY_1",
    "architect": "GROQ_API_KEY_2",
    "developer": "GROQ_API_KEY_3",
    "critic": "GROQ_API_KEY_3",
    "persona": "GROQ_API_KEY_4",
    "auditor": "GROQ_API_KEY_4",
}


def _client(agent_name: str) -> Groq:
    env_key = _AGENT_ENV_KEYS[agent_name]
    return _groq_client_for_env_key(env_key)


VALID_AGENT_NAMES = frozenset(_AGENT_ENV_KEYS.keys())

AGENT_MODELS = {
    "supervisor": GROQ_LLAMA_70B,
    "researcher": GROQ_LLAMA_70B,
    "architect": GROQ_LLAMA_70B,
    "developer": GROQ_LLAMA_70B,
    "critic": GROQ_LLAMA_70B,
    "persona": GROQ_LLAMA_8B_INSTANT,
    "auditor": GROQ_LLAMA_8B_INSTANT,
}


def _backoff_sleep(seconds: float) -> None:
    """Caps wall time so sync nodes do not block the worker for tens of seconds (see ORIN_GROQ_BACKOFF_CAP_SEC)."""
    cap = float(os.getenv("ORIN_GROQ_BACKOFF_CAP_SEC", "8"))
    time.sleep(min(seconds, cap))


def _with_retry(func, max_retries: int = 4):
    """Retries on rate limit errors with exponential backoff (Groq). Sync sleep — use cap to limit freeze."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            err = str(e).lower()
            is_rate_limit = any(
                token in err
                for token in (
                    "429",
                    "rate limit",
                    "quota",
                    "exhausted",
                    "too many requests",
                )
            )
            if is_rate_limit:
                wait = (2**attempt) + random.uniform(0, 1)
                print(f"[RATE LIMIT] {attempt + 1}/{max_retries} — retrying in {wait:.1f}s (capped)")
                _backoff_sleep(wait)
                if attempt == max_retries - 1:
                    raise RuntimeError(
                        f"Rate limit not resolved after {max_retries} retries. "
                        f"Original error: {e}"
                    ) from e
            else:
                raise
    raise RuntimeError("Retry loop exited unexpectedly")


def call_agent_llm(
    agent_name: str,
    system_prompt: str,
    user_message: str,
    messages_history: list[dict] | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
    *,
    max_history_turns: int | None = None,
    max_history_content_chars: int | None = None,
) -> str:
    if agent_name not in VALID_AGENT_NAMES:
        raise ValueError(
            f"Unknown agent: '{agent_name}'. Valid agents: {sorted(VALID_AGENT_NAMES)}"
        )

    client = _client(agent_name)
    model = AGENT_MODELS[agent_name]

    turns = max_history_turns if max_history_turns is not None else MAX_HISTORY_TURNS
    history = truncate_messages(
        messages_history or [],
        max_turns=turns,
        content_max_chars=max_history_content_chars,
    )
    api_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    api_messages.extend(history)
    api_messages.append({"role": "user", "content": user_message})

    def _call():
        response = client.chat.completions.create(
            model=model,
            messages=api_messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content

    return _with_retry(_call)


def validate_all_keys() -> dict:
    required = [
        "GROQ_API_KEY_1",
        "GROQ_API_KEY_2",
        "GROQ_API_KEY_3",
        "GROQ_API_KEY_4",
        "TAVILY_API_KEY",
        "E2B_API_KEY",
        "LOGFIRE_TOKEN",
    ]
    results = {key: ("ok" if os.getenv(key) else "MISSING") for key in required}
    missing = [k for k, v in results.items() if v == "MISSING"]
    if missing:
        print(f"[WARNING] Missing env vars: {missing}")
    else:
        print("[OK] All environment variables present")
    return results
