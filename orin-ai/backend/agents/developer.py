"""Developer agent — code generation and E2B test loop."""

from __future__ import annotations

from pathlib import Path

import logfire

from llm_clients import call_agent_llm
from llm_json import parse_json_object
from state import AgentState, TestRun, build_agent_context, get_developer_prompt_mode
from tools.e2b_tools import run_code_in_sandbox

_PROMPTS = Path(__file__).resolve().parent.parent / "prompts"

_GEMINI_FLASH = "gemini-2.5-flash-preview-05-20"


def _load_prompt_file(name: str) -> str:
    return (_PROMPTS / name).read_text(encoding="utf-8")


def _build_developer_user_message(state: AgentState) -> str:
    """CRITICAL context: goal, full architecture, failures, iteration (per Orin plan)."""
    next_iter = state["iteration_count"] + 1
    parts: list[str] = [
        f"=== ITERATION ===\n{next_iter}",
        build_agent_context(state),
    ]
    arch = state.get("architecture")
    if arch:
        parts.append(
            "=== FULL ARCHITECTURE SPEC ===\n"
            f"--- docker-compose ---\n{arch.docker_compose[:6000]}\n"
            f"--- db_schema ---\n{arch.db_schema[:6000]}\n"
            f"--- api_spec ---\n{arch.api_spec[:6000]}\n"
            f"--- tech_rationale ---\n{arch.tech_rationale[:4000]}"
        )
    recent_fails = [t for t in state["test_results"] if not t.passed][-2:]
    if recent_fails:
        parts.append("=== LAST FAILED TERMINALS (stderr ≤500 chars) ===")
        for tf in recent_fails:
            parts.append(tf.stderr[-500:])
    return "\n\n".join(parts)


def generate_code(state: AgentState) -> dict[str, str]:
    mode = get_developer_prompt_mode(state)
    if mode == "panic":
        system = _load_prompt_file("developer_panic.txt")
        from agents.supervisor import generate_correction_directive

        directive = generate_correction_directive(state)
        extra = f"\n\n=== CORRECTION DIRECTIVE ===\n{directive}"
    else:
        system = _load_prompt_file("developer.txt")
        extra = ""

    user = _build_developer_user_message(state) + extra
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

    text = call_agent_llm("developer", system, user, max_tokens=16384)
    files = parse_json_object(text or "")

    if mode != "panic":
        for k in ("app.py", "requirements.txt", "test_app.py"):
            if k not in files:
                raise ValueError(f"Developer output missing required file {k!r}")
    return files


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


def developer_node(state: AgentState) -> AgentState:
    next_iter = state["iteration_count"] + 1
    with logfire.span(
        "developer_agent",
        iteration=state["iteration_count"],
        mode=state["mode"],
        task_id=state["current_task_id"],
        model=_GEMINI_FLASH,
    ):
        patch = generate_code(state)
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
        state["test_results"] = [*state["test_results"], test_run]
        state["code_files"] = code_files
        state["iteration_count"] = next_iter
        if state["iteration_count"] >= 3:
            state["mode"] = "panic"
    return state
