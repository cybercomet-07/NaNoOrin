"""Append NDJSON lines for Cursor debug session (no secrets).

Canonical file (works in Docker + host): **next to this module**
  `orin-ai/backend/.debug-d0a254.ndjson`
  (in the API container this is `/app/.debug-d0a254.ndjson`, visible on the host via the volume mount).

Optional mirror when the repo layout is `.../orin-ai/backend/` (local dev): repo `.cursor/debug-d0a254.log`.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any

_SESSION = "d0a254"
_HERE = Path(__file__).resolve().parent

# Order matters: write to backend dir first (always mounted / writable in Docker).
_PATHS: list[Path] = [_HERE / ".debug-d0a254.ndjson"]
if (_HERE.parent / "docker-compose.yml").is_file() or (_HERE.parent / "frontend").is_dir():
    _PATHS.append(_HERE.parent.parent / ".cursor" / "debug-d0a254.log")

_warned_once = False


def dbg(
    hypothesis_id: str,
    location: str,
    message: str,
    data: dict[str, Any] | None = None,
    run_id: str | None = None,
) -> None:
    global _warned_once
    line = (
        json.dumps(
            {
                "sessionId": _SESSION,
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data or {},
                "timestamp": int(time.time() * 1000),
                "runId": run_id,
            },
            default=str,
        )
        + "\n"
    )
    for p in _PATHS:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, "a", encoding="utf-8") as f:
                f.write(line)
                f.flush()
            if not _warned_once:
                _warned_once = True
                sys.stderr.write(f"[debug_session] NDJSON -> {p}\n")
                sys.stderr.flush()
            return
        except Exception:
            continue
