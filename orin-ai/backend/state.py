# TODO: Phase 1 — Full AgentState schema + helper functions
# Reference: execution_plan.md PROMPT 1.1

from typing import TypedDict, Literal, Optional
from dataclasses import dataclass, field


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
    db_schema: str        # SQLAlchemy models as string
    api_spec: str         # OpenAPI YAML as string
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
    research_output: Optional[str]   # competitor analysis JSON
    personas: Optional[str]          # user personas JSON

    # Phase 2 outputs
    architecture: Optional[Architecture]

    # Phase 3 outputs
    code_files: dict[str, str]       # {filename: code_string}
    test_results: list[TestRun]      # all test runs including failures

    # Phase 4 outputs
    audit_report: Optional[dict]
    audit_passed: bool

    # Pipeline control
    status: Literal["RUNNING", "FAILED", "PANIC", "FINALIZED"]
    error_log: list[str]
    messages: list[dict]


def get_initial_state(goal: str) -> AgentState:
    """Returns a fresh AgentState for a new pipeline run."""
    # TODO: Phase 1 — implement fully per PROMPT 1.1
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
        status="RUNNING",
        error_log=[],
        messages=[]
    )


def build_agent_context(state: AgentState) -> str:
    """
    Always call this before any LLM invocation.
    Injects exactly the right context — no more, no less.
    Truncates to prevent context window overflow.
    TODO: Phase 1 — implement fully per PROMPT 1.1
    """
    pass


def get_developer_prompt_mode(state: AgentState) -> str:
    """Returns 'panic' or 'normal' based on iteration count and mode."""
    # TODO: Phase 1 — implement fully per PROMPT 1.1
    pass
