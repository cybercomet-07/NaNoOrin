"""Pytest configuration — load .env before any tests (Orin plan Phase 7)."""

from __future__ import annotations

import os
import sys

# Phase 8.2: allow importing `main` without full keys / live E2B during tests
os.environ.setdefault("ORIN_SKIP_STARTUP_VALIDATION", "1")
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
