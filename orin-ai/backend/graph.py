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


def join_node(state: AgentState) -> AgentState:
    """
    Phase 1 join: LangGraph fan-in waits for Researcher AND Persona.
    Ensures Architect sees research_output and personas; fills defaults if missing.
    """
    issues: list[str] = []

    if not state.get("research_output"):
        issues.append("WARNING: research_output missing — Architect proceeding without market data")
        state["research_output"] = DEFAULT_RESEARCH_JSON

    if not state.get("personas"):
        issues.append("WARNING: personas missing — Architect proceeding without user personas")
        state["personas"] = DEFAULT_PERSONAS_JSON

    if issues:
        state["error_log"].extend(issues)
        logfire.warning("join_node_incomplete", issues=issues)

    logfire.info(
        "join_node_complete",
        has_research=bool(state.get("research_output")),
        has_personas=bool(state.get("personas")),
    )
    # Single fan-in point: merge parallel phase into `messages` (avoids LangGraph parallel
    # merge conflict when Researcher and Persona both wrote to `messages`).
    ro = (state.get("research_output") or "")[:3000]
    pe = (state.get("personas") or "")[:3000]
    state["messages"] = (state.get("messages", []) + [
        {"role": "user", "content": "[join] Research + Persona outputs merged for downstream agents."},
        {"role": "assistant", "content": f"[research excerpt]\n{ro}\n\n[personas excerpt]\n{pe}"},
    ])[-12:]
    return state


def end_success_node(state: AgentState) -> AgentState:
    state["status"] = "FINALIZED"
    return state


def end_failed_node(state: AgentState) -> AgentState:
    state["status"] = "FAILED"
    return state


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
    },
)

builder.add_edge("readme_generator", "end_success")

builder.add_edge("end_success", END)
builder.add_edge("end_failed", END)

# No checkpointer: we do not need resume/human-in-the-loop; MemorySaver grows unbounded per thread_id.
graph = builder.compile()

__all__ = ["graph", "get_initial_state"]
