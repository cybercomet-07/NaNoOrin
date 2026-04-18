"""Fail-fast environment validation before the API serves traffic (Orin plan Phase 8.2)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def validate_environment() -> None:
    """
    Validates required API keys and external service connections.
    Fails fast with clear error messages rather than mysterious runtime errors.
    """
    backend = Path(__file__).resolve().parent
    load_dotenv(backend / ".env")
    load_dotenv()

    required_keys = {
        "ANTHROPIC_API_KEY": "Claude agents (Supervisor, Architect, Developer, Auditor)",
        "GROQ_API_KEY": "Researcher and Persona agents (fast inference)",
        "TAVILY_API_KEY": "Market research search",
        "E2B_API_KEY": "Code execution sandbox (CRITICAL — demo breaks without this)",
        "LOGFIRE_TOKEN": "Observability dashboard (open during demo)",
    }

    optional_keys = {
        "OPENAI_API_KEY": "GPT-4o-mini fallback if Groq rate-limits",
    }

    errors: list[str] = []
    warnings: list[str] = []

    for key, description in required_keys.items():
        value = os.getenv(key)
        if not value or value.endswith("..."):
            errors.append(f"MISSING: {key} — needed for {description}")

    for key, description in optional_keys.items():
        if not os.getenv(key):
            warnings.append(f"OPTIONAL MISSING: {key} — {description}")

    if warnings:
        for w in warnings:
            print(f"⚠️  {w}")

    if errors:
        print("\n❌ Orin AI startup FAILED. Fix these before demo:\n")
        for e in errors:
            print(f"   {e}")
        sys.exit(1)

    print("✅ All API keys present. Testing connections...")

    try:
        from tools.e2b_tools import validate_e2b_connection

        assert validate_e2b_connection()
        print("✅ E2B sandbox: connected")
    except Exception as e:
        print(f"❌ E2B sandbox FAILED: {e}")
        sys.exit(1)

    print("\n✅ Orin AI ready. Starting server...\n")
