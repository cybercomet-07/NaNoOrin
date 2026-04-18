"""Integration-style pipeline tests (Orin plan Phase 7.1)."""

from __future__ import annotations

import os

import pytest

from agents.auditor import regex_scan
from agents.critic import route_after_critic
from state import (
    TestRun,
    build_agent_context,
    get_developer_prompt_mode,
    get_initial_state,
)
from tools.e2b_tools import validate_e2b_connection


def test_agent_state_initialization() -> None:
    state = get_initial_state("Build a FastAPI todo app")
    assert state["goal"] == "Build a FastAPI todo app"
    assert state["status"] == "RUNNING"
    assert state["iteration_count"] == 0
    assert state["mode"] == "normal"
    assert state["test_results"] == []


def test_panic_mode_activates_at_iteration_3() -> None:
    state = get_initial_state("test goal")
    state["iteration_count"] = 3
    mode = get_developer_prompt_mode(state)
    assert mode == "panic"


def test_route_after_critic_pass() -> None:
    state = get_initial_state("test")
    state["test_results"] = [TestRun(0, "1 passed", "", 0, True)]
    state["iteration_count"] = 1
    route = route_after_critic(state)
    assert route == "auditor"


def test_route_after_critic_fail_retry() -> None:
    state = get_initial_state("test")
    state["test_results"] = [TestRun(0, "", "ModuleNotFoundError", 1, False)]
    state["iteration_count"] = 1
    route = route_after_critic(state)
    assert route == "developer"


def test_route_after_critic_max_iterations() -> None:
    state = get_initial_state("test")
    state["iteration_count"] = 6
    route = route_after_critic(state)
    assert route == "end_failed"


def test_build_agent_context_truncates_failures() -> None:
    state = get_initial_state("test goal")
    state["test_results"] = [
        TestRun(i, "stdout", "x" * 1000, 1, False) for i in range(5)
    ]
    context = build_agent_context(state)
    assert context.count("Iteration") <= 2


@pytest.mark.skipif(not os.getenv("E2B_API_KEY"), reason="E2B_API_KEY not set — skip live sandbox check")
def test_e2b_connection() -> None:
    assert validate_e2b_connection() is True


def test_auditor_catches_hardcoded_key() -> None:
    code_files = {"app.py": 'API_KEY = "sk-abcdef1234567890abcdef1234567890"'}
    violations = regex_scan(code_files)
    assert len(violations) > 0
    assert any(v["type"] == "hardcoded_secret" for v in violations)
