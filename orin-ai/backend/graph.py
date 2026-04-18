"""LangGraph pipeline — supervisor fan-out, join, architect → dev → critic loop, auditor gate."""

from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from agents.architect import architect_node
from agents.auditor import auditor_node, route_after_audit
from agents.critic import critic_node, route_after_critic
from agents.developer import developer_node
from agents.persona import persona_node
from agents.researcher import researcher_node
from agents.safe_nodes import safe_node_wrapper
from agents.supervisor import supervisor_node
from state import AgentState, get_initial_state

_researcher_safe = safe_node_wrapper(researcher_node)
_persona_safe = safe_node_wrapper(persona_node)
_architect_safe = safe_node_wrapper(architect_node)


def supervisor_with_fanout(state: AgentState):
    """Supervisor runs, then fans out to Researcher AND Persona in parallel."""
    updated = supervisor_node(state)
    return [
        Send("researcher", {**updated, "current_task_id": "research_001"}),
        Send("persona", {**updated, "current_task_id": "persona_001"}),
    ]


def join_node(state: AgentState) -> AgentState:
    """Waits for both Phase 1 agents. Routes to Architect."""
    return state


def end_success_node(state: AgentState) -> AgentState:
    state["status"] = "FINALIZED"
    return state


def end_failed_node(state: AgentState) -> AgentState:
    state["status"] = "FAILED"
    return state


builder = StateGraph(AgentState)

builder.add_node("supervisor", supervisor_with_fanout)
builder.add_node("researcher", _researcher_safe)
builder.add_node("persona", _persona_safe)
builder.add_node("join", join_node)
builder.add_node("architect", _architect_safe)
builder.add_node("developer", developer_node)
builder.add_node("critic", critic_node)
builder.add_node("auditor", auditor_node)
builder.add_node("end_success", end_success_node)
builder.add_node("end_failed", end_failed_node)

builder.add_edge(START, "supervisor")
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
        "end_success": "end_success",
        "developer": "developer",
    },
)

builder.add_edge("end_success", END)
builder.add_edge("end_failed", END)

graph = builder.compile(checkpointer=MemorySaver())

__all__ = ["graph", "get_initial_state"]
