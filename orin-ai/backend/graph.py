"""LangGraph pipeline — supervisor fan-out, join, architect → dev → critic loop, auditor gate."""

from __future__ import annotations

import logfire
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from agents.architect import architect_node
from agents.auditor import auditor_node, route_after_audit
from agents.critic import critic_node, route_after_critic
from agents.developer import developer_node
from agents.persona import persona_node
from agents.readme_generator import readme_node
from agents.researcher import researcher_node
from agents.safe_nodes import safe_node_wrapper
from agents.supervisor import supervisor_node
from state import (
    DEFAULT_PERSONAS_JSON,
    DEFAULT_RESEARCH_JSON,
    AgentState,
    get_initial_state,
)

_researcher_safe = safe_node_wrapper(researcher_node)
_readme_safe = safe_node_wrapper(readme_node)


def fan_out_research_and_persona(state: AgentState):
    """
    LangGraph 1.x: list[Send] is only valid from conditional edges, not from a node body.
    Supervisor updates state; this branch fans out to Researcher and Persona in parallel.
    """
    return [
        Send("researcher", {**state, "current_task_id": "research_001"}),
        Send("persona", {**state, "current_task_id": "persona_001"}),
    ]


def join_node(state: AgentState) -> dict:
    """
    Phase 1 join: LangGraph fan-in waits for Researcher AND Persona.
    Ensures Architect sees research_output and personas; fills defaults if missing.
    Returns a partial state update (no in-place mutation — reducers merge `error_log`).
    """
    issues: list[str] = []

    research_output = state.get("research_output")
    if not research_output:
        issues.append("WARNING: research_output missing — Architect proceeding without market data")
        research_output = DEFAULT_RESEARCH_JSON

    personas = state.get("personas")
    if not personas:
        issues.append("WARNING: personas missing — Architect proceeding without user personas")
        personas = DEFAULT_PERSONAS_JSON

    out: dict = {"research_output": research_output, "personas": personas}
    if issues:
        out["error_log"] = issues
        logfire.warning("join_node_incomplete", issues=issues)

    logfire.info(
        "join_node_complete",
        has_research=bool(research_output),
        has_personas=bool(personas),
    )
    ro = (research_output or "")[:3000]
    pe = (personas or "")[:3000]
    out["messages"] = (state.get("messages", []) + [
        {"role": "user", "content": "[join] Research + Persona outputs merged for downstream agents."},
        {"role": "assistant", "content": f"[research excerpt]\n{ro}\n\n[personas excerpt]\n{pe}"},
    ])[-12:]
    return out


def end_success_node(state: AgentState) -> dict:
    return {"status": "FINALIZED"}


def end_failed_node(state: AgentState) -> dict:
    return {"status": "FAILED"}


builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_node)
builder.add_node("researcher", _researcher_safe)
builder.add_node("persona", persona_node)
builder.add_node("join", join_node)
builder.add_node("architect", architect_node)
builder.add_node("developer", developer_node)
builder.add_node("critic", critic_node)
builder.add_node("auditor", auditor_node)
builder.add_node("readme_generator", _readme_safe)
builder.add_node("end_success", end_success_node)
builder.add_node("end_failed", end_failed_node)

builder.add_edge(START, "supervisor")
builder.add_conditional_edges("supervisor", fan_out_research_and_persona)
builder.add_edge("researcher", "join")
builder.add_edge("persona", "join")
builder.add_edge("join", "architect")
builder.add_edge("architect", "developer")
builder.add_edge("developer", "critic")

builder.add_conditional_edges(
    "critic",
    route_after_critic,
    {
        "auditor": "auditor",
        "developer": "developer",
        "end_failed": "end_failed",
    },
)

builder.add_conditional_edges(
    "auditor",
    route_after_audit,
    {
        "readme_generator": "readme_generator",
        "developer": "developer",
        "end_failed": "end_failed",
    },
)

builder.add_edge("readme_generator", "end_success")

builder.add_edge("end_success", END)
builder.add_edge("end_failed", END)

# No checkpointer: we do not need resume/human-in-the-loop; MemorySaver grows unbounded per thread_id.
graph = builder.compile()

__all__ = ["graph", "get_initial_state"]
