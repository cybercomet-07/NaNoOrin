"""Auditor agent — regex security scan + Gemini Flash-Lite review."""

from __future__ import annotations

import json
import re
from typing import Any

import logfire

from llm_clients import call_gemini, call_gemini_lite, call_groq, GEMINI_FLASH, GEMINI_FLASH_LITE, GROQ_LLAMA  # noqa: F401
from llm_json import parse_json_object
from state import AgentState

_SECRET_RE = re.compile(r"[A-Za-z0-9]{32,}")
_SQL_FSTRING = re.compile(r'f["\'][\s\S]*?SELECT', re.IGNORECASE)
_EVAL_RE = re.compile(r"\b(eval|exec)\s*\(")
_ROUTE_RE = re.compile(r"@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(")


def regex_scan(code_files: dict[str, str]) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    for fname, content in code_files.items():
        lines = content.splitlines()
        for i, line in enumerate(lines, start=1):
            for m in _SECRET_RE.findall(line):
                if m.isdigit() or len(m) < 32:
                    continue
                violations.append(
                    {
                        "file": fname,
                        "line_number": i,
                        "type": "hardcoded_secret",
                        "severity": "high",
                        "snippet": line.strip()[:200],
                    }
                )
            if _SQL_FSTRING.search(line):
                violations.append(
                    {
                        "file": fname,
                        "line_number": i,
                        "type": "sql_injection_risk",
                        "severity": "high",
                        "snippet": line.strip()[:200],
                    }
                )
            if _EVAL_RE.search(line):
                violations.append(
                    {
                        "file": fname,
                        "line_number": i,
                        "type": "unsafe_eval_exec",
                        "severity": "medium",
                        "snippet": line.strip()[:200],
                    }
                )
            if _ROUTE_RE.search(line) and "Depends" not in line and "# noqa" not in line:
                violations.append(
                    {
                        "file": fname,
                        "line_number": i,
                        "type": "missing_auth_dependency",
                        "severity": "low",
                        "snippet": line.strip()[:200],
                    }
                )
    return violations


def llm_security_review(code_files: dict[str, str], regex_violations: list) -> dict[str, Any]:
    bundle = "\n\n".join(f"=== {fn} ===\n{src[:12000]}" for fn, src in code_files.items())
    system = (
        "You are a security auditor. Review code for: hardcoded secrets, SQL injection, "
        "unsafe eval, missing auth. Return JSON: "
        '{clean: bool, violations: [{file, line, type, severity}]}. No markdown.'
    )
    user = (
        f"Regex findings (may include false positives):\n{json.dumps(regex_violations, indent=2)[:8000]}\n\n"
        f"Code:\n{bundle[:100000]}"
    )
    text = call_gemini_lite(system_prompt=system, user_message=user, max_tokens=4096)
    return parse_json_object(text)


def auditor_node(state: AgentState) -> AgentState:
    code_files = state.get("code_files") or {}
    violations = regex_scan(code_files)

    with logfire.span(
        "auditor_agent",
        violations_found=len(violations),
        audit_passed=state.get("audit_passed", False),
        files_scanned=len(code_files),
        model=GEMINI_FLASH_LITE,
    ):
        if not violations:
            state["audit_report"] = {"regex_violations": [], "llm_review": None}
            state["audit_passed"] = True
            state["status"] = "FINALIZED"
            return state

        review = llm_security_review(code_files, violations)
        state["audit_report"] = {"regex_violations": violations, "llm_review": review}
        clean = bool(review.get("clean"))
        state["audit_passed"] = clean
        if clean:
            state["status"] = "FINALIZED"
        else:
            state["error_log"].append("auditor: security review failed; remediation required")
            state["messages"].append(
                {
                    "role": "system",
                    "content": json.dumps(
                        {"security_remediation": review.get("violations", [])}
                    )[:12000],
                }
            )
        logfire.info("auditor_result", audit_passed=state["audit_passed"])
    return state


def route_after_audit(state: AgentState) -> str:
    if state.get("audit_passed"):
        return "end_success"
    return "developer"
