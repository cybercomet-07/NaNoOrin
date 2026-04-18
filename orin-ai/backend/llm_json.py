"""Extract JSON from LLM outputs (strip fences, find object/array)."""

from __future__ import annotations

import json
import re
from typing import Any


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*", re.IGNORECASE)
_END_FENCE_RE = re.compile(r"\s*```\s*$", re.IGNORECASE)


def strip_code_fences(text: str) -> str:
    t = text.strip()
    t = _FENCE_RE.sub("", t, count=1)
    t = _END_FENCE_RE.sub("", t, count=1)
    return t.strip()


def parse_json_array(text: str) -> list[Any]:
    raw = strip_code_fences(text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("[")
        end = raw.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise
        data = json.loads(raw[start : end + 1])
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    return data


def parse_json_object(text: str) -> dict[str, Any]:
    raw = strip_code_fences(text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        data = json.loads(raw[start : end + 1])
    if not isinstance(data, dict):
        raise ValueError("Expected JSON object")
    return data
