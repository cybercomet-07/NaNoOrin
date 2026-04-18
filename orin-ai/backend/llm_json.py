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


def fix_unescaped_controls_in_json_strings(s: str) -> str:
    """
    LLMs often emit JSON with literal newlines/tabs inside quoted strings; json.loads rejects those.
    Walk the string and escape control chars only while inside double-quoted regions (toggle on unescaped \").
    """
    out: list[str] = []
    i = 0
    in_str = False
    while i < len(s):
        c = s[i]
        if not in_str:
            out.append(c)
            if c == '"':
                in_str = True
            i += 1
            continue
        if c == "\\":
            if i + 1 < len(s):
                out.append(c)
                out.append(s[i + 1])
                i += 2
            else:
                out.append(c)
                i += 1
            continue
        if c == '"':
            in_str = False
            out.append(c)
            i += 1
            continue
        if c == "\n":
            out.append("\\n")
            i += 1
            continue
        if c == "\r":
            out.append("\\r")
            i += 1
            continue
        if c == "\t":
            out.append("\\t")
            i += 1
            continue
        if ord(c) < 32:
            out.append(f"\\u{ord(c):04x}")
            i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


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
    candidates: list[str] = [raw]
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        sub = raw[start : end + 1]
        if sub != raw:
            candidates.append(sub)

    last_err: json.JSONDecodeError | None = None
    for cand in candidates:
        for fixed in (cand, fix_unescaped_controls_in_json_strings(cand)):
            try:
                data = json.loads(fixed)
            except json.JSONDecodeError as e:
                last_err = e
                continue
            if isinstance(data, dict):
                return data

    if last_err is not None:
        raise last_err
    raise ValueError("Expected JSON object")
