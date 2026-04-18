"""Graceful degradation wrappers for LangGraph nodes (Orin plan Phase 8.1)."""

from __future__ import annotations

from collections.abc import Callable

import logfire

from debug_session_log import dbg
from state import AgentState


def safe_node_wrapper(node_fn: Callable[[AgentState], AgentState]) -> Callable[[AgentState], AgentState]:
    """Catch exceptions, log, append to error_log — keeps the graph from hard-crashing."""

    def wrapper(state: AgentState) -> AgentState:
        try:
            return node_fn(state)
        except Exception as e:
            logfire.error(f"{node_fn.__name__}_failed", error=str(e))
            # region agent log
            try:
                dbg(
                    "H1",
                    "safe_nodes:wrapper",
                    "safe_node_exception",
                    {
                        "node": node_fn.__name__,
                        "exc_type": type(e).__name__,
                        "msg": str(e)[:800],
                    },
                )
            except Exception:
                pass
            # endregion
            # Return additive chunk only — LangGraph merges parallel updates via Annotated[add] on error_log.
            return {"error_log": [f"{node_fn.__name__}: {str(e)}"]}

    wrapper.__name__ = f"safe_{node_fn.__name__}"
    wrapper.__doc__ = node_fn.__doc__
    return wrapper
