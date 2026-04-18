# TODO: Phase 3 — Supervisor Agent (Head of Digital Workforce)
# Reference: execution_plan.md PROMPT 3.1
# Model: Claude claude-sonnet-4-20250514

import json
import logfire
from anthropic import Anthropic
from dotenv import load_dotenv

from state import AgentState, Task, build_agent_context

load_dotenv()

# TODO: initialise Anthropic client with ANTHROPIC_API_KEY


def generate_task_graph(state: AgentState) -> list[Task]:
    """
    Calls Claude with supervisor.txt system prompt.
    Parses JSON response into list[Task] dataclass instances.
    Validates dependency order: Researcher/Persona first, Architect depends on both.
    """
    # TODO: implement
    pass


def generate_correction_directive(state: AgentState) -> str:
    """
    Called when iteration_count >= 3 (panic mode).
    Sends goal + current_task + last 3 error_log entries to Claude.
    Returns a Correction Directive string for Developer's next prompt.
    """
    # TODO: implement
    pass


def supervisor_node(state: AgentState) -> AgentState:
    """LangGraph node — orchestrates task graph generation."""
    with logfire.span("supervisor_agent",
                      goal_preview=state["goal"][:100],
                      task_count=len(state.get("task_graph", []))):
        # TODO: call generate_task_graph(), set state["task_graph"] and state["current_task_id"]
        pass
    return state
