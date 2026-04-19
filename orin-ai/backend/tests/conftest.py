"""Pytest configuration — load .env before any tests (Orin plan Phase 7)."""

from __future__ import annotations

import os
import sys

# Phase 8.2: allow importing `main` without full keys / live E2B during tests
os.environ.setdefault("ORIN_SKIP_STARTUP_VALIDATION", "1")

# llm_clients builds Groq clients at import — pytest collection fails without keys.
# Placeholders are enough for unit tests that do not call the network.
_PLACEHOLDER = "pytest-placeholder-not-for-production"
for _k in (
    "GROQ_API_KEY_1",
    "GROQ_API_KEY_2",
    "GROQ_API_KEY_3",
    "GROQ_API_KEY_4",
    "TAVILY_API_KEY",
    "E2B_API_KEY",
    "LOGFIRE_TOKEN",
):
    os.environ.setdefault(_k, _PLACEHOLDER)
from pathlib import Path

from dotenv import load_dotenv

# Ensure `import state`, `import graph` work when running `pytest` from `backend/`
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

_env_file = _BACKEND / ".env"
if _env_file.is_file():
    load_dotenv(_env_file)
load_dotenv()
