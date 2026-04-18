# TODO: Phase 3 — Developer Agent (Code Generation + Self-Healing Loop)
# Reference: execution_plan.md PROMPT 3.5
# Model: Claude claude-sonnet-4-20250514 (primary), GPT-4o (fallback)
# This is the heart of the self-healing loop — most complex agent.

import json
import logfire
from anthropic import Anthropic
from openai import OpenAI
from dotenv import load_dotenv

from state import AgentState, TestRun, build_agent_context, get_developer_prompt_mode
from tools.e2b_tools import run_code_in_sandbox

load_dotenv()

# TODO: initialise Anthropic and OpenAI clients
# TODO: load developer.txt and developer_panic.txt prompt files


def generate_code(state: AgentState) -> dict[str, str]:
    """
    Determines prompt mode (normal/panic) via get_developer_prompt_mode().
    Builds context via build_agent_context().
    Calls Claude — must return {filename: code_string}.
    Minimum output: {"app.py": ..., "requirements.txt": ..., "test_app.py": ...}
    """
    # TODO: implement
    pass


def execute_and_test(code_files: dict[str, str], iteration: int) -> TestRun:
    """
    Calls run_code_in_sandbox() from e2b_tools.
    Converts result dict into TestRun dataclass.
    passed = True only if exit_code == 0.
    """
    # TODO: implement
    pass


def developer_node(state: AgentState) -> AgentState:
    """LangGraph node — generates code, runs in E2B, appends TestRun, increments iteration."""
    with logfire.span("developer_agent",
                      iteration=state["iteration_count"],
                      mode=state["mode"],
                      task_id=state["current_task_id"]):
        with logfire.span("e2b_sandbox_execution"):
            # TODO: call generate_code(), execute_and_test()
            # TODO: append TestRun to state["test_results"]
            # TODO: update state["code_files"], state["iteration_count"]
            # TODO: if iteration_count >= 3 → state["mode"] = "panic"
            pass
    return state
