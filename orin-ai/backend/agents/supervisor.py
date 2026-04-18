"""Supervisor agent — Head of Digital Workforce (task graph + correction directives)."""

from __future__ import annotations

import json
from pathlib import Path

import logfire

from llm_clients import call_gemini, call_gemini_lite, call_groq, GEMINI_FLASH, GEMINI_FLASH_LITE, GROQ_LLAMA  # noqa: F401
from llm_json import parse_json_array
from state import AgentState, Task, build_agent_context

_PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


def _load_supervisor_prompt() -> str:
    return (_PROMPTS / "supervisor.txt").read_text(encoding="utf-8")


def _truncate_messages(state: AgentState) -> list[dict]:
    return state.get("messages", [])[-6:]


def _fallback_task_graph() -> list[Task]:
    return [
        Task("task_research", "Researcher", [], "Competitor research JSON produced"),
        Task("task_persona", "Persona", [], "Three personas JSON produced"),
        Task("task_architect", "Architect", ["task_research", "task_persona"], "Architecture artifact complete"),
        Task("task_developer", "Developer", ["task_architect"], "Pytest passes in sandbox"),
        Task("task_critic", "Critic", ["task_developer"], "Tests validated by critic"),
        Task("task_auditor", "Auditor", ["task_critic"], "Security audit passed"),
    ]


def _tasks_from_payload(rows: list) -> list[Task]:
    out: list[Task] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        out.append(
            Task(
                task_id=str(r["task_id"]),
                assigned_agent=str(r["assigned_agent"]),
                dependencies=[str(x) for x in r.get("dependencies", [])],
                success_criteria=str(r.get("success_criteria", "")),
                status=str(r.get("status", "PENDING")),
                iteration_count=int(r.get("iteration_count", 0)),
            )
        )
    return out


def _validate_task_graph(tasks: list[Task]) -> None:
    if not tasks:
        raise ValueError("Task graph is empty")

    by_agent: dict[str, list[Task]] = {}
    for t in tasks:
        key = t.assigned_agent.strip().lower()
        by_agent.setdefault(key, []).append(t)

    for t in tasks:
        agent = t.assigned_agent.strip().lower()
        if agent in ("researcher", "persona") and t.dependencies:
            raise ValueError(f"{t.assigned_agent} must have empty dependencies")

    researchers = by_agent.get("researcher", [])
    personas = by_agent.get("persona", [])
    architects = by_agent.get("architect", [])
    developers = by_agent.get("developer", [])

    if not researchers or not personas:
        raise ValueError("Task graph must include Researcher and Persona tasks")
    if len(architects) != 1:
        raise ValueError("Task graph must include exactly one Architect task")
    if len(developers) != 1:
        raise ValueError("Task graph must include exactly one Developer task")

    r_ids = {t.task_id for t in researchers}
    p_ids = {t.task_id for t in personas}
    arch = architects[0]
    if not r_ids.issubset(set(arch.dependencies)) or not p_ids.issubset(set(arch.dependencies)):
        raise ValueError("Architect task must depend on all Researcher and Persona task_ids")

    dev = developers[0]
    if arch.task_id not in dev.dependencies:
        raise ValueError("Developer task must depend on the Architect task_id")


def generate_task_graph(state: AgentState) -> list[Task]:
    system = _load_supervisor_prompt()
    ctx = build_agent_context(state)
    recent = _truncate_messages(state)
    user_parts = [
        ctx,
        f"Goal: {state['goal']}\n\nGenerate the TaskGraph JSON.",
    ]
    if recent:
        user_parts.append("Recent dialogue (last 6 turns):\n" + json.dumps(recent, indent=2)[:12000])

    user_message = "\n\n".join(user_parts)

    text = call_gemini(system_prompt=system, user_message=user_message, max_tokens=8192)
    rows = parse_json_array(text)
    tasks = _tasks_from_payload(rows)
    _validate_task_graph(tasks)
    return tasks


def generate_correction_directive(state: AgentState) -> str:
    system = (
        "You are the Head of Digital Workforce in panic mode. "
        "Produce a short, actionable Correction Directive for the Developer agent."
    )
    errs = state.get("error_log", [])[-3:]
    recent = _truncate_messages(state)
    user_message = "\n\n".join(
        [
            build_agent_context(state),
            f"Goal: {state['goal']}",
            f"Current task: {state.get('current_task_id', '')}",
            "Last error_log entries:\n" + "\n".join(errs) if errs else "(no errors)",
            "Recent dialogue (last 6 turns):\n" + json.dumps(recent, indent=2)[:8000] if recent else "",
            "Return a single Correction Directive paragraph (plain text, no JSON).",
        ]
    )
    out = call_gemini(system_prompt=system, user_message=user_message, max_tokens=2048)
    return out.strip()


def supervisor_node(state: AgentState) -> AgentState:
    with logfire.span("supervisor_agent", goal_preview=state["goal"][:100], model=GEMINI_FLASH):
        try:
            tasks = generate_task_graph(state)
        except Exception as e:
            logfire.warning("supervisor_task_graph_failed", error=str(e))
            state["error_log"].append(f"supervisor_generate_task_graph: {e}")
            tasks = _fallback_task_graph()
        state["task_graph"] = tasks
        state["current_task_id"] = tasks[0].task_id if tasks else ""
        logfire.info("supervisor_result", task_count=len(tasks))
    return state
