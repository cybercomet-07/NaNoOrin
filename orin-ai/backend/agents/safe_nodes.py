"""Graceful degradation wrappers for LangGraph nodes (Orin plan Phase 8.1)."""

from __future__ import annotations

from collections.abc import Callable

import logfire

from llm_clients import call_agent_llm  # noqa: F401
from state import AgentState


def safe_node_wrapper(node_fn: Callable[[AgentState], AgentState]) -> Callable[[AgentState], AgentState]:
    """Catch exceptions, log, append to error_log — keeps the graph from hard-crashing."""

    def wrapper(state: AgentState) -> AgentState:
        try:
            return node_fn(state)
        except Exception as e:
            logfire.error(f"{node_fn.__name__}_failed", error=str(e))
            state["error_log"].append(f"{node_fn.__name__}: {str(e)}")
            return state

    wrapper.__name__ = f"safe_{node_fn.__name__}"
    wrapper.__doc__ = node_fn.__doc__
    return wrapper
