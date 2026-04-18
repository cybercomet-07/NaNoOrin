"""Fail-fast environment validation before the API serves traffic (Orin plan Phase 8.2)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Safe print: flush with utf-8 even on Windows cp1252 terminals
def _print(msg: str) -> None:
    sys.stdout.buffer.write((msg + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()


def validate_environment() -> None:
    """
    Validates required API keys and external service connections.
    Fails fast with clear error messages rather than mysterious runtime errors.
    """
    backend = Path(__file__).resolve().parent
    load_dotenv(backend / ".env")
    load_dotenv()

    required_keys = {
        "GOOGLE_API_KEY_1": "Gemini - Supervisor",
        "GOOGLE_API_KEY_2": "Gemini - Architect",
        "GOOGLE_API_KEY_3": "Gemini - Developer / Critic",
        "GOOGLE_API_KEY_4": "Gemini - Persona / Auditor",
        "GROQ_API_KEY_1": "Groq - Researcher",
        "TAVILY_API_KEY": "Market research search",
        "E2B_API_KEY": "Code execution sandbox (CRITICAL - demo breaks without this)",
        "LOGFIRE_TOKEN": "Observability dashboard (open during demo)",
    }

    errors: list[str] = []

    for key, description in required_keys.items():
        value = os.getenv(key)
        if not value or value.endswith("..."):
            errors.append(f"MISSING: {key} - needed for {description}")

    if errors:
        _print("\n[FAIL] Orin AI startup FAILED. Fix these before demo:\n")
        for e in errors:
            _print(f"   {e}")
        sys.exit(1)

    _print("[OK] All API keys present. Testing connections...")

    try:
        from tools.e2b_tools import validate_e2b_connection

        assert validate_e2b_connection()
        _print("[OK] E2B sandbox: connected")
    except Exception as e:
        _print(f"[FAIL] E2B sandbox FAILED: {e}")
        sys.exit(1)

    _print("\n[OK] Orin AI ready. Starting server...\n")
