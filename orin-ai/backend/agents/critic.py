"""Critic node — heuristic test evaluation (no LLM)."""

from __future__ import annotations

import logfire

from state import AgentState, Task, TestRun


def evaluate_test_result(state: AgentState) -> tuple[bool, str]:
    tests = state.get("test_results") or []
    if not tests:
        return False, "No test results found"
    last: TestRun = tests[-1]
    if last.exit_code != 0:
        return False, f"Non-zero exit code: {last.exit_code}"
    if "FAILED" in last.stdout:
        return False, "stdout contains FAILED"
    if "ERROR" in last.stdout:
        return False, "stdout contains ERROR"
    if "ModuleNotFoundError" in last.stderr:
        return False, "stderr contains ModuleNotFoundError"
    return True, "Heuristic pass"


def check_for_security_flags(state: AgentState) -> bool:
    tests = state.get("test_results") or []
    if not tests:
        return False
    last = tests[-1]
    if last.exit_code != 0:
        return False
    if "warning" in last.stderr.lower():
        return True
    if "DeprecationWarning" in last.stdout:
        return True
    return False


def _mark_current_task_passed(state: AgentState) -> None:
    tid = state.get("current_task_id")
    if not tid:
        return
    updated: list[Task] = []
    for t in state["task_graph"]:
        if t.task_id == tid:
            updated.append(
                Task(
                    task_id=t.task_id,
                    assigned_agent=t.assigned_agent,
                    dependencies=t.dependencies,
                    success_criteria=t.success_criteria,
                    status="PASSED",
                    iteration_count=t.iteration_count,
                )
            )
        else:
            updated.append(t)
    state["task_graph"] = updated


def critic_node(state: AgentState) -> AgentState:
    passed, reason = evaluate_test_result(state)
    with logfire.span(
        "critic_node",
        passed=passed,
        iteration=state["iteration_count"],
        reason=reason[:100],
    ):
        if passed:
            _mark_current_task_passed(state)
        else:
            state["error_log"].append(f"critic: {reason}")
    return state


def route_after_critic(state: AgentState) -> str:
    if state["iteration_count"] > 5:
        return "end_failed"
    ok, _ = evaluate_test_result(state)
    if ok:
        return "auditor"
    return "developer"
