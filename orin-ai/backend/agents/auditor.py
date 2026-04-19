"""Auditor agent — regex security scan + Groq llama-3.1-8b-instant review."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import logfire

from llm_clients import call_agent_llm
from llm_json import parse_json_object
from state import AgentState

# Narrower than "32+ alnum" (which flags UUIDs without dashes, long identifiers, etc.):
# API-key-shaped tokens, hex digests, base64 blobs, AWS-style keys.
_SECRET_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?i)\b(?:sk|pk)_(?:live|test|prod)_[a-z0-9]{20,}\b"),
    re.compile(r"(?i)\bsk-[a-z0-9]{20,}\b"),
    re.compile(r"\b[a-f0-9]{64}\b"),
    re.compile(r"\b[a-f0-9]{40}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b[A-Za-z0-9+/]{43,}={0,2}\b"),
)
_SQL_FSTRING = re.compile(r'f["\'][\s\S]*?SELECT', re.IGNORECASE)
_EVAL_RE = re.compile(r"\b(eval|exec)\s*\(")
_ROUTE_RE = re.compile(r"@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(")

_MAX_AUDIT_LOOPS = max(1, int(os.getenv("ORIN_MAX_AUDIT_LOOPS", "4")))


def _line_has_secret_candidate(line: str) -> list[str]:
    """Return substrings that look like embedded secrets (conservative to reduce false positives)."""
    hits: list[str] = []
    for pat in _SECRET_PATTERNS:
        for m in pat.findall(line):
            s = m if isinstance(m, str) else m[0]
            if len(s) < 32:
                continue
            if s.isdigit():
                continue
            # Ignore low-entropy runs (e.g. repeated chars)
            if len(set(s)) < 6:
                continue
            hits.append(s)
    return hits


def regex_scan(code_files: dict[str, str]) -> list[dict[str, Any]]:
    violations: list[dict[str, Any]] = []
    for fname, content in code_files.items():
        lines = content.splitlines()
        for i, line in enumerate(lines, start=1):
            for m in _line_has_secret_candidate(line):
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


def llm_security_review(
    code_files: dict[str, str],
    regex_violations: list,
    messages_history: list[dict] | None = None,
) -> tuple[dict[str, Any], str]:
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
    text = call_agent_llm(
        "auditor",
        system,
        user,
        messages_history=messages_history,
        max_tokens=4096,
    )
    return parse_json_object(text or ""), user


def auditor_node(state: AgentState) -> dict:
    code_files = state.get("code_files") or {}
    violations = regex_scan(code_files)
    prior_retries = int(state.get("audit_retry_count", 0))

    with logfire.span(
        "auditor_agent",
        violations_found=len(violations),
        audit_passed=state.get("audit_passed", False),
        files_scanned=len(code_files),
    ):
        if not violations:
            return {
                "audit_report": {"regex_violations": [], "llm_review": None},
                "audit_passed": True,
                "audit_retry_count": 0,
            }

        review, user_message = llm_security_review(
            code_files,
            violations,
            messages_history=state.get("messages", []),
        )
        audit_report = {"regex_violations": violations, "llm_review": review}
        clean = bool(review.get("clean"))

        audit_result = json.dumps({"clean": clean, "violations": review.get("violations", [])})
        messages = (state.get("messages", []) + [
            {"role": "user", "content": user_message[:2000]},
            {"role": "assistant", "content": audit_result[:2000]},
        ])[-12:]

        err_log: list[str] = []
        if not clean:
            err_log.append("auditor: security review failed; remediation required")
            messages = messages + [
                {
                    "role": "system",
                    "content": json.dumps({"security_remediation": review.get("violations", [])})[:12000],
                }
            ]

        new_retries = 0 if clean else prior_retries + 1

        logfire.info("auditor_result", audit_passed=clean)
        out: dict = {
            "audit_report": audit_report,
            "audit_passed": clean,
            "audit_retry_count": new_retries,
            "messages": messages,
        }
        if err_log:
            out["error_log"] = err_log
        return out


def route_after_audit(state: AgentState) -> str:
    if state.get("audit_passed"):
        return "readme_generator"
    if int(state.get("audit_retry_count", 0)) >= _MAX_AUDIT_LOOPS:
        return "end_failed"
    return "developer"
