"""Developer agent — code generation and E2B test loop."""

from __future__ import annotations

from pathlib import Path

import logfire

from llm_clients import call_agent_llm
from llm_json import parse_json_object
from state import AgentState, TestRun, get_developer_prompt_mode
from tools.e2b_tools import run_code_in_sandbox

_PROMPTS = Path(__file__).resolve().parent.parent / "prompts"

# Groq on_demand tier often caps total request tokens (~12k). Keep developer input small:
# avoid duplicating api_spec (see _build_developer_user_message).
_ARCH_DOCKER = 1400
_ARCH_DB = 1400
_ARCH_API = 2800
_ARCH_RAT = 900
_MAX_DEV_USER_CHARS = 11000


def _load_prompt_file(name: str) -> str:
    return (_PROMPTS / name).read_text(encoding="utf-8")


def _build_developer_user_message(
    state: AgentState,
    correction_directive: str | None = None,
) -> str:
    """Goal, compact architecture (single pass — no duplicate api_spec), failures."""
    next_iter = state["iteration_count"] + 1
    parts: list[str] = [f"=== ITERATION ===\n{next_iter}"]
    if correction_directive:
        parts.append(
            f"=== SUPERVISOR CORRECTION DIRECTIVE ===\n{correction_directive[:2000]}"
        )
    parts.append(f"=== GOAL ===\n{state['goal'][:2500]}")
    parts.append(f"=== CURRENT TASK ===\n{state.get('current_task_id', 'none')}")
    recent_fails = [t for t in state["test_results"] if not t.passed][-2:]
    if recent_fails:
        parts.append("=== LAST FAILED RUNS (compact) ===")
        for tf in recent_fails:
            parts.append(
                f"iter={tf.iteration} exit={tf.exit_code} stderr={tf.stderr[-400:]!s}"
            )
    arch = state.get("architecture")
    if arch:
        parts.append(
            "=== ARCHITECTURE (implement against this) ===\n"
            f"--- docker-compose ---\n{arch.docker_compose[:_ARCH_DOCKER]}\n"
            f"--- db_schema ---\n{arch.db_schema[:_ARCH_DB]}\n"
            f"--- api_spec (OpenAPI) ---\n{arch.api_spec[:_ARCH_API]}\n"
            f"--- tech_rationale ---\n{arch.tech_rationale[:_ARCH_RAT]}"
        )
    raw = "\n\n".join(parts)
    if len(raw) > _MAX_DEV_USER_CHARS:
        raw = (
            raw[: _MAX_DEV_USER_CHARS - 120]
            + "\n\n…[user prompt truncated for Groq request size limits]\n"
        )
    return raw


def generate_code(
    state: AgentState,
    correction_directive: str | None = None,
) -> tuple[dict[str, str], str]:
    mode = get_developer_prompt_mode(state)
    if mode == "panic":
        system = _load_prompt_file("developer_panic.txt")
        if correction_directive is None:
            from agents.supervisor import generate_correction_directive

            correction_directive = generate_correction_directive(state)
    else:
        system = _load_prompt_file("developer.txt")

    user = _build_developer_user_message(
        state,
        correction_directive=correction_directive if mode == "panic" else None,
    )
    if mode == "panic":
        user += (
            "\n\nRespond with JSON mapping only filenames you are changing to their full contents. "
            "You may omit unchanged files."
        )
    else:
        user += (
            "\n\nRespond with a single JSON object mapping filenames to file contents. "
            'Required keys: "app.py", "requirements.txt", "test_app.py". '
            "No markdown fences."
        )

    # 8B-instant has a 30k TPM on free tier — plenty of headroom for a single call.
    # Keep output reasonable (full JSON fits in ~2500 tokens for small demo prompts).
    text = call_agent_llm(
        "developer",
        system,
        user,
        messages_history=state.get("messages", []),
        max_tokens=3072,
        max_history_turns=2,
        max_history_content_chars=800,
    )
    files = parse_json_object(text or "")
    files = {str(k): str(v) for k, v in files.items()}

    if mode != "panic":
        for k in ("app.py", "requirements.txt", "test_app.py"):
            if k not in files:
                raise ValueError(f"Developer output missing required file {k!r}")
    return files, user


def execute_and_test(code_files: dict[str, str], iteration: int) -> TestRun:
    result = run_code_in_sandbox(code_files)
    passed = bool(result.get("passed"))
    return TestRun(
        iteration=iteration,
        stdout=str(result.get("stdout", "")),
        stderr=str(result.get("stderr", "")),
        exit_code=int(result.get("exit_code", 1)),
        passed=passed,
    )


def developer_node(state: AgentState) -> dict:
    next_iter = state["iteration_count"] + 1

    correction_directive: str | None = None
    if state["mode"] == "panic" and state.get("error_log"):
        from agents.supervisor import generate_correction_directive

        correction_directive = generate_correction_directive(state)
        logfire.info(
            "correction_directive_generated",
            directive_preview=correction_directive[:100],
            iteration=state["iteration_count"],
        )

    with logfire.span(
        "developer_agent",
        iteration=state["iteration_count"],
        mode=state["mode"],
        task_id=state["current_task_id"],
    ):
        try:
            patch, user_message = generate_code(state, correction_directive=correction_directive)
            code_files = {**state.get("code_files", {}), **patch}
            for req in ("app.py", "requirements.txt", "test_app.py"):
                if req not in code_files:
                    raise ValueError(f"Missing {req!r} after merge — cannot run sandbox.")
            with logfire.span("e2b_sandbox_execution"):
                test_run = execute_and_test(code_files, next_iter)
                logfire.info(
                    "test_complete",
                    passed=test_run.passed,
                    exit_code=test_run.exit_code,
                    stdout_preview=test_run.stdout[:200],
                    stderr_preview=test_run.stderr[:200],
                )
        except Exception as e:
            logfire.error("developer_node_soft_fail", error=str(e)[:500])
            user_message = f"[developer error] {str(e)[:1500]}"
            err_tail = str(e)[:800]
            test_run = TestRun(
                iteration=next_iter,
                stdout="",
                stderr=err_tail,
                exit_code=1,
                passed=False,
            )
            new_iter = next_iter
            mode = "panic" if new_iter >= 3 else state["mode"]
            return {
                "error_log": [f"developer_node: {type(e).__name__}: {err_tail}"],
                "test_results": [*state["test_results"], test_run],
                "iteration_count": new_iter,
                "mode": mode,
                "messages": (state.get("messages", []) + [
                    {"role": "user", "content": user_message[:3000]},
                    {"role": "assistant", "content": f"[code failed] {test_run.stderr[:400]}"},
                ])[-12:],
            }

        new_iter = next_iter
        mode = "panic" if new_iter >= 3 else state["mode"]
        test_summary = f"passed={test_run.passed} exit={test_run.exit_code} stderr={test_run.stderr[:300]}"
        return {
            "test_results": [*state["test_results"], test_run],
            "code_files": code_files,
            "iteration_count": new_iter,
            "mode": mode,
            "messages": (state.get("messages", []) + [
                {"role": "user", "content": user_message[:3000]},
                {"role": "assistant", "content": f"[code generated] {test_summary}"},
            ])[-12:],
        }
