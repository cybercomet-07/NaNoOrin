# TODO: Phase 3 — Auditor Agent (Security Gate)
# Reference: execution_plan.md PROMPT 3.7
# Model: Claude Haiku (claude-haiku-4-5-20251001) — fast and cheap
# Minimum viable: regex scan (no LLM required for basic demo)

import re
import logfire
from anthropic import Anthropic
from dotenv import load_dotenv

from state import AgentState

load_dotenv()

# TODO: initialise Anthropic client (Haiku)


def regex_scan(code_files: dict[str, str]) -> list[dict]:
    """
    Scans all code files as strings for:
    - Hardcoded secrets (long alphanumeric strings ≥32 chars)
    - SQL injection (f-string interpolation in queries)
    - Unsafe eval/exec with user-controlled input
    - Route definitions missing auth dependency
    Returns list of {file, line_number, type, severity, snippet}.
    """
    # TODO: implement
    pass


def llm_security_review(code_files: dict[str, str], regex_violations: list) -> dict:
    """
    Only called when regex_scan finds violations OR time permits.
    Sends code + regex findings to Claude Haiku.
    Returns {clean: bool, violations: [{file, line, type, severity}]}.
    """
    # TODO: implement
    pass


def auditor_node(state: AgentState) -> AgentState:
    """LangGraph node — regex scan, optional LLM review, sets audit_passed + status."""
    violations = []  # TODO: call regex_scan(state["code_files"])
    with logfire.span("auditor_agent",
                      violations_found=len(violations),
                      audit_passed=state.get("audit_passed", False),
                      files_scanned=len(state.get("code_files", {}))):
        # TODO: if violations → llm_security_review() → re-route to Developer
        # TODO: if clean → state["audit_passed"] = True, state["status"] = "FINALIZED"
        pass
    return state


def route_after_audit(state: AgentState) -> str:
    """Returns 'end_success' if audit_passed, else 'developer' for remediation."""
    if state.get("audit_passed"):
        return "end_success"
    return "developer"
