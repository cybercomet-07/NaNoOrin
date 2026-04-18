"""
Orin AI — Shared LLM Client  (GAP-2 / G2.1)
────────────────────────────────────────────
Single entry-point for every LLM call in the pipeline.
Agents MUST use call_agent_llm() — never instantiate OpenAI/Groq clients directly.

Agent → Key mapping (one dedicated key per agent = no shared rate-limit quota):
  supervisor  → GOOGLE_API_KEY_1  (Gemini Flash)
  architect   → GOOGLE_API_KEY_2  (Gemini Flash)
  developer   → GOOGLE_API_KEY_3  (Gemini Flash)
  critic      → GOOGLE_API_KEY_3  (Gemini Flash — sequential with developer, no conflict)
  persona     → GOOGLE_API_KEY_4  (Gemini Flash-Lite)
  auditor     → GOOGLE_API_KEY_4  (Gemini Flash-Lite — runs last, no conflict)
  researcher  → GROQ_API_KEY_1    (Groq Llama 3.3 70B)

Message truncation (Orin plan spec):
  truncate_messages() enforces the 6-turn window before every LLM call.
  Without this, long runs silently exceed context windows.
"""

import os
import time
import random
from openai import OpenAI
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# ── Message truncation (Orin plan: "truncate messages[] to last 6-8 turns") ──
MAX_HISTORY_TURNS = 6


def truncate_messages(messages: list[dict], max_turns: int = MAX_HISTORY_TURNS) -> list[dict]:
    """
    Keep only the last N user/assistant pairs from a conversation history.
    System messages are stripped here — they are always passed separately as system_prompt.

    Without this, long pipeline runs silently exceed context windows causing
    either API errors or garbage output.
    """
    convo = [m for m in messages if m.get("role") in ("user", "assistant")]
    return convo[-(max_turns * 2):]


# ── Model name constants ──────────────────────────────────────────────────────
GEMINI_FLASH      = "gemini-2.5-flash-preview-05-20"
GEMINI_FLASH_LITE = "gemini-2.5-flash-lite-preview-06-17"
GROQ_LLAMA        = "llama-3.3-70b-versatile"
GEMINI_BASE_URL   = "https://generativelanguage.googleapis.com/v1beta/openai/"

# ── Client factory helpers ────────────────────────────────────────────────────
def _make_gemini_client(env_key: str) -> OpenAI:
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return OpenAI(api_key=api_key, base_url=GEMINI_BASE_URL)

def _make_groq_client(env_key: str) -> Groq:
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return Groq(api_key=api_key)

# ── Per-agent client instances ────────────────────────────────────────────────
AGENT_CLIENTS = {
    "supervisor": _make_gemini_client("GOOGLE_API_KEY_1"),
    "architect":  _make_gemini_client("GOOGLE_API_KEY_2"),
    "developer":  _make_gemini_client("GOOGLE_API_KEY_3"),
    "critic":     _make_gemini_client("GOOGLE_API_KEY_3"),
    "persona":    _make_gemini_client("GOOGLE_API_KEY_4"),
    "auditor":    _make_gemini_client("GOOGLE_API_KEY_4"),
    "researcher": _make_groq_client("GROQ_API_KEY_1"),
}

# ── Per-agent model assignments ───────────────────────────────────────────────
AGENT_MODELS = {
    "supervisor": GEMINI_FLASH,
    "architect":  GEMINI_FLASH,
    "developer":  GEMINI_FLASH,
    "critic":     GEMINI_FLASH,
    "persona":    GEMINI_FLASH_LITE,
    "auditor":    GEMINI_FLASH_LITE,
    "researcher": GROQ_LLAMA,
}

# ── Retry wrapper ─────────────────────────────────────────────────────────────
def _with_retry(func, max_retries: int = 4):
    """
    Retries on rate limit errors with exponential backoff.
    Handles 429 errors from both Gemini and Groq.
    """
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            err = str(e).lower()
            is_rate_limit = any(
                token in err for token in
                ["429", "rate limit", "quota", "exhausted", "too many requests"]
            )
            if is_rate_limit:
                wait = (2 ** attempt) + random.uniform(0, 1)
                print(f"[RATE LIMIT] {attempt+1}/{max_retries} — retrying in {wait:.1f}s")
                time.sleep(wait)
                if attempt == max_retries - 1:
                    raise RuntimeError(
                        f"Rate limit not resolved after {max_retries} retries. "
                        f"Original error: {e}"
                    )
            else:
                raise
    raise RuntimeError("Retry loop exited unexpectedly")

# ── Single public function — used by every agent ──────────────────────────────
def call_agent_llm(
    agent_name: str,
    system_prompt: str,
    user_message: str,
    messages_history: list[dict] | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """
    Call the LLM assigned to the given agent.
    Automatically uses the correct API key, client, and model.

    Args:
        agent_name:       One of: supervisor, architect, developer, critic,
                          persona, auditor, researcher
        system_prompt:    The agent's system-level instructions
        user_message:     The user/task content for this call
        messages_history: Optional prior turns from state["messages"].
                          Truncated to last 6 turns automatically.
                          Pass None (default) for stateless single-turn calls.
        max_tokens:       Maximum tokens in response (default 4096)
        temperature:      Sampling temperature (default 0.3)

    Returns:
        str: The model's response content

    Example (stateless):
        result = call_agent_llm("developer", SYSTEM_PROMPT, context)

    Example (with history):
        result = call_agent_llm("developer", SYSTEM_PROMPT, context,
                                messages_history=state["messages"])
    """
    if agent_name not in AGENT_CLIENTS:
        raise ValueError(
            f"Unknown agent: '{agent_name}'. "
            f"Valid agents: {list(AGENT_CLIENTS.keys())}"
        )

    client = AGENT_CLIENTS[agent_name]
    model  = AGENT_MODELS[agent_name]

    # Build message list: system + truncated history + current user turn
    history = truncate_messages(messages_history or [])
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


# ── Startup validation — call once at app start ───────────────────────────────
def validate_all_keys() -> dict:
    """
    Checks all required env vars are present.
    Call this in main.py startup to catch missing keys early.
    Returns dict of {key_name: "ok" | "MISSING"}
    """
    required = [
        "GOOGLE_API_KEY_1", "GOOGLE_API_KEY_2",
        "GOOGLE_API_KEY_3", "GOOGLE_API_KEY_4",
        "GROQ_API_KEY_1",
        "TAVILY_API_KEY", "E2B_API_KEY", "LOGFIRE_TOKEN",
    ]
    results = {}
    for key in required:
        results[key] = "ok" if os.getenv(key) else "MISSING"
    missing = [k for k, v in results.items() if v == "MISSING"]
    if missing:
        print(f"[WARNING] Missing env vars: {missing}")
    else:
        print("[OK] All environment variables present")
    return results
