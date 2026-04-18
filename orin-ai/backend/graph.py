# TODO: Phase 4 — LangGraph pipeline assembly
# Reference: execution_plan.md PROMPT 4.1

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Send

from state import AgentState, get_initial_state

# TODO: import all agent node functions once agents are implemented
# from agents.supervisor import supervisor_node
# from agents.researcher import researcher_node
# from agents.persona import persona_node
# from agents.architect import architect_node
# from agents.developer import developer_node
# from agents.critic import critic_node, route_after_critic
# from agents.auditor import auditor_node, route_after_audit


def supervisor_with_fanout(state: AgentState):
    """Supervisor runs, then fans out to Researcher AND Persona in parallel."""
    # TODO: call supervisor_node(state) then fan out via Send()
    pass


def join_node(state: AgentState) -> AgentState:
    """Waits for both Phase 1 agents. Routes to Architect."""
    # Both research_output and personas should now be set
    return state


def end_success_node(state: AgentState) -> AgentState:
    state["status"] = "FINALIZED"
    return state


def end_failed_node(state: AgentState) -> AgentState:
    state["status"] = "FAILED"
    return state


# TODO: Phase 4 — uncomment and wire once all agents exist
# builder = StateGraph(AgentState)
# builder.add_node("supervisor", supervisor_with_fanout)
# builder.add_node("researcher", researcher_node)
# builder.add_node("persona", persona_node)
# builder.add_node("join", join_node)
# builder.add_node("architect", architect_node)
# builder.add_node("developer", developer_node)
# builder.add_node("critic", critic_node)
# builder.add_node("auditor", auditor_node)
# builder.add_node("end_success", end_success_node)
# builder.add_node("end_failed", end_failed_node)
#
# builder.add_edge(START, "supervisor")
# builder.add_edge("researcher", "join")
# builder.add_edge("persona", "join")
# builder.add_edge("join", "architect")
# builder.add_edge("architect", "developer")
# builder.add_edge("developer", "critic")
#
# builder.add_conditional_edges("critic", route_after_critic, {
#     "auditor": "auditor",
#     "developer": "developer",
#     "end_failed": "end_failed"
# })
#
# builder.add_conditional_edges("auditor", route_after_audit, {
#     "end_success": "end_success",
#     "developer": "developer"
# })
#
# builder.add_edge("end_success", END)
# builder.add_edge("end_failed", END)
#
# graph = builder.compile(checkpointer=MemorySaver())
