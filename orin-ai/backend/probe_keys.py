"""
Probes every Groq and DeepSeek key in .env with a 1-token completion.
Prints OK / AUTH_FAIL / RATE_LIMIT / NET_ERR for each.
Run: py -3 probe_keys.py
"""
from __future__ import annotations
import os
import sys
from dotenv import load_dotenv

load_dotenv()

try:
    from groq import Groq
except ImportError:
    print("groq package missing"); sys.exit(1)
try:
    from openai import OpenAI
except ImportError:
    print("openai package missing"); sys.exit(1)


def _classify(e: Exception) -> str:
    m = str(e).lower()
    if "401" in m or "invalid api key" in m or "unauthorized" in m:
        return "AUTH_FAIL"
    if "429" in m or "rate limit" in m or "quota" in m:
        return "RATE_LIMIT"
    return f"NET_ERR ({type(e).__name__}: {str(e)[:80]})"


def probe_groq(env_key: str) -> str:
    api_key = os.getenv(env_key)
    if not api_key:
        return "MISSING"
    try:
        client = Groq(api_key=api_key)
        r = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            temperature=0,
        )
        return f"OK  ({r.choices[0].message.content!r})"
    except Exception as e:
        return _classify(e)


def probe_deepseek(env_key: str) -> str:
    api_key = os.getenv(env_key)
    if not api_key:
        return "MISSING"
    try:
        base = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        client = OpenAI(api_key=api_key, base_url=base)
        r = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            temperature=0,
        )
        return f"OK  ({(r.choices[0].message.content or '')!r})"
    except Exception as e:
        return _classify(e)


if __name__ == "__main__":
    print("=== Groq keys ===")
    for i in range(1, 6):
        k = f"GROQ_API_KEY_{i}"
        print(f"  {k}: {probe_groq(k)}")
    print("=== DeepSeek keys ===")
    for i in range(1, 3):
        k = f"DEEPSEEK_API_KEY_{i}"
        print(f"  {k}: {probe_deepseek(k)}")
