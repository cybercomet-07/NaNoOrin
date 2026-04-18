"""
Adversarial demo test (Orin plan Phase 7.2).

First Developer iteration is forced to use a non-existent package (`fastchroma`);
subsequent iterations use the real `generate_code` (Claude + E2B).

Requires full API keys and billable calls — skipped when keys are missing.
Run the night before demo: `pytest tests/test_self_healing.py -v` (three times).
"""

from __future__ import annotations

import os
import uuid

import pytest

import agents.developer as developer
from graph import graph
from state import AgentState, get_initial_state

# Match backend/llm_clients.py + tools — real keys required for full graph + APIs
_DEMO_KEYS = (
    "GOOGLE_API_KEY_1",
    "GOOGLE_API_KEY_2",
    "GOOGLE_API_KEY_3",
    "GOOGLE_API_KEY_4",
    "GROQ_API_KEY_1",
    "E2B_API_KEY",
    "TAVILY_API_KEY",
)

# conftest sets this placeholder so imports work without a real .env
_PYTEST_PLACEHOLDER = "pytest-placeholder-not-for-production"


def _full_stack_configured() -> bool:
    # Opt-in only — avoids running billable / flaky graph on every `pytest` when .env exists
    if os.getenv("ORIN_LIVE_SELF_HEALING") != "1":
        return False
    return all(
        os.getenv(k) and os.getenv(k) != _PYTEST_PLACEHOLDER for k in _DEMO_KEYS
    )


@pytest.mark.asyncio
@pytest.mark.skipif(
    not _full_stack_configured(),
    reason="Set ORIN_LIVE_SELF_HEALING=1 and real GOOGLE_API_KEY_1–4, GROQ_API_KEY_1, E2B_API_KEY, TAVILY_API_KEY",
)
async def test_self_healing_wrong_library(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Developer tries `fastchroma` → install/test fail → Critic fails →
    retry with real `generate_code` → eventual pass and audit.
    """
    real_generate = developer.generate_code

    def generate_code_first_bad(state: AgentState) -> dict[str, str]:
        if state["iteration_count"] == 0:
            return {
                "app.py": "import fastchroma\n",
                "requirements.txt": "fastchroma\npytest\n",
                "test_app.py": "def test_placeholder():\n    assert True\n",
            }
        return real_generate(state)

    monkeypatch.setattr(developer, "generate_code", generate_code_first_bad)

    state = get_initial_state(
        "Build a Python vector search service using chromadb for semantic search. "
        "Include a pytest test that adds 3 documents and queries them."
    )
    thread = f"demo-test-{uuid.uuid4().hex[:12]}"
    config = {"configurable": {"thread_id": thread}}

    result = await graph.ainvoke(state, config)

    assert result["status"] == "FINALIZED", f"Pipeline failed: {result['error_log']}"
    assert result["audit_passed"] is True
    assert len(result["test_results"]) >= 1
    assert result["test_results"][-1].passed is True

    print(f"Self-healing completed in {result['iteration_count']} iterations")
    print(f"Final test output: {result['test_results'][-1].stdout[:500]}")
