"""Tests for LLM JSON extraction and repair."""

from __future__ import annotations

from llm_json import fix_unescaped_controls_in_json_strings, parse_json_object


def test_parse_json_object_repairs_literal_newline_in_string_value() -> None:
    # Invalid JSON: newline inside quoted string (common LLM mistake)
    bad = '{"app.py": "print(1)' + "\n" + 'print(2)", "x": "y"}'
    out = parse_json_object(bad)
    assert out["app.py"] == "print(1)\nprint(2)"
    assert out["x"] == "y"


def test_parse_valid_json_unchanged() -> None:
    ok = '{"a": 1, "b": "hello\\nworld"}'
    assert parse_json_object(ok) == {"a": 1, "b": "hello\nworld"}


def test_fix_unescaped_does_not_break_structure() -> None:
    s = '{"k": "v"}'
    assert fix_unescaped_controls_in_json_strings(s) == s
