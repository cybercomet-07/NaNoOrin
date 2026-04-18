# TODO: Phase 3 — Critic Node (Heuristic Test Validator)
# Reference: execution_plan.md PROMPT 3.6
# NO LLM call — pure heuristic for speed and reliability.
# This node IS the self-healing loop's gatekeeper.

import logfire

from state import AgentState, TestRun


def evaluate_test_result(state: AgentState) -> tuple[bool, str]:
    """
    Reads last TestRun from state["test_results"].
    PASS: exit_code == 0 AND stdout has no FAILED/ERROR AND stderr has no ModuleNotFoundError.
    Returns (passed: bool, reason: str).
    """
    # TODO: implement
    pass


def check_for_security_flags(state: AgentState) -> bool:
    """
    Flags DeprecationWarning or stderr "warning" for Auditor attention.
    Does NOT fail the pipeline — informational only.
    """
    # TODO: implement
    pass


def critic_node(state: AgentState) -> AgentState:
    """LangGraph node — evaluates last test run, updates task_graph status."""
    passed, reason = False, "Not yet evaluated"  # TODO: call evaluate_test_result()
    with logfire.span("critic_node",
                      passed=passed,
                      iteration=state["iteration_count"],
                      reason=reason[:100]):
        # TODO: if PASS → mark current task PASSED in task_graph
        # TODO: if FAIL → append reason to state["error_log"]
        pass
    return state


def route_after_critic(state: AgentState) -> str:
    """
    CRITICAL routing function — drives the self-healing loop.
    Returns: "auditor" | "developer" | "end_failed"
    """
    # TODO: implement
    # if state["iteration_count"] > 5: return "end_failed"
    # if state["iteration_count"] >= 3: return "developer"  (panic)
    # if last_test.passed: return "auditor"
    # else: return "developer"  (retry)
    pass
