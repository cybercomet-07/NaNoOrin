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
        "GOOGLE_API_KEY": "Gemini (Supervisor, Architect, Developer, Persona, Auditor)",
        "GROQ_API_KEY": "Researcher agent (fast inference)",
        "TAVILY_API_KEY": "Market research search",
        "E2B_API_KEY": "Code execution sandbox (CRITICAL — demo breaks without this)",
        "LOGFIRE_TOKEN": "Observability dashboard (open during demo)",
    }

    errors: list[str] = []

    for key, description in required_keys.items():
        value = os.getenv(key)
        if not value or value.endswith("..."):
            errors.append(f"MISSING: {key} — needed for {description}")

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
