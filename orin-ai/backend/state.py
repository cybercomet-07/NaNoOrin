"""AgentState — single source of truth for the Orin AI pipeline."""

import json
from dataclasses import dataclass
from operator import add
from typing import Annotated, Literal, Optional, TypedDict

# Used by join_node and persona fallback when research/persona LLM output is missing or invalid.
DEFAULT_RESEARCH_JSON = json.dumps(
    {
        "competitors": [],
        "pricing": [],
        "gaps": ["Market research unavailable — proceeding with general knowledge"],
        "market_size": "Unknown",
    }
)
DEFAULT_PERSONAS_JSON = json.dumps(
    [
        {
            "name": "Default User",
            "role": "Developer",
            "company_size": "Startup",
            "pain_points": ["Too much manual work"],
            "job_to_be_done": "Build software faster",
            "success_metric": "Working app in under 10 minutes",
        }
    ]
)


@dataclass
class Task:
    task_id: str
    assigned_agent: str  # Supervisor|Researcher|Architect|Developer|Critic|Auditor
    dependencies: list[str]
    success_criteria: str
    status: str = "PENDING"  # PENDING|RUNNING|PASSED|FAILED
    iteration_count: int = 0


@dataclass
class Architecture:
    docker_compose: str
    db_schema: str  # SQLAlchemy models as string
    api_spec: str  # OpenAPI YAML as string
    tech_rationale: str


@dataclass
class TestRun:
    iteration: int
    stdout: str
    stderr: str
    exit_code: int
    passed: bool


class AgentState(TypedDict):
    # Core intent
    goal: str
    task_graph: list[Task]

    # Execution context
    current_task_id: str
    iteration_count: int
    mode: str  # "normal" | "panic"

    # Phase 1 outputs
    research_output: Optional[str]  # competitor analysis JSON
    personas: Optional[str]  # user personas JSON

    # Phase 2 outputs
    architecture: Optional[Architecture]

    # Phase 3 outputs
    code_files: dict[str, str]  # {filename: code_string}
    test_results: list[TestRun]  # all test runs including failures

    # Phase 4 outputs
    audit_report: Optional[dict]
    audit_passed: bool
    # Loops: developer → auditor when audit fails; capped to avoid infinite remediation.
    audit_retry_count: int

    # Pipeline control
    status: Literal["RUNNING", "FAILED", "PANIC", "FINALIZED"]
    # Parallel branches (e.g. Researcher + Persona) may each append errors — use reducer merge.
    error_log: Annotated[list[str], add]
    messages: list[dict]


def get_initial_state(goal: str) -> AgentState:
    """Returns a fresh AgentState for a new pipeline run."""
    return AgentState(
        goal=goal,
        task_graph=[],
        current_task_id="",
        iteration_count=0,
        mode="normal",
        research_output=None,
        personas=None,
        architecture=None,
        code_files={},
        test_results=[],
        audit_report=None,
        audit_passed=False,
        audit_retry_count=0,
        status="RUNNING",
        error_log=[],
        messages=[],
    )


def build_agent_context(state: AgentState) -> str:
    """
    CRITICAL: Always call this before any LLM invocation.
    Injects exactly the right context — no more, no less.
    Truncates to prevent context window overflow.
    """
    context_parts = [
        f"=== ORIGINAL GOAL ===\n{state['goal']}",
        f"=== CURRENT TASK ===\n{state.get('current_task_id', 'none')}",
    ]

    recent_failures = [t for t in state["test_results"] if not t.passed][-2:]
    if recent_failures:
        context_parts.append("=== PREVIOUS FAILURES (diagnose these) ===")
        for tf in recent_failures:
            context_parts.append(
                f"Iteration {tf.iteration}:\nSTDOUT: {tf.stdout[:300]}\nSTDERR: {tf.stderr[:500]}"
            )

    if state.get("architecture"):
        arch = state["architecture"]
        context_parts.append(f"=== ARCHITECTURE SPEC ===\n{arch.api_spec}")

    return "\n\n".join(context_parts)


def get_developer_prompt_mode(state: AgentState) -> str:
    """Returns 'panic' or 'normal' based on iteration count and mode."""
    if state["iteration_count"] >= 3 or state["mode"] == "panic":
        return "panic"
    return "normal"
