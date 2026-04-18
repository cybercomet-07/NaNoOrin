"""
Orin AI Demo Warm-Up Script
Run this 30 minutes before demo: cd backend && python demo_warmup.py
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent
load_dotenv(_backend / ".env")
load_dotenv()

DEMO_PROMPTS = [
    # Happy path demo prompt (run this live)
    "Build a FastAPI REST API for a task manager with JWT authentication, PostgreSQL database, and a full pytest test suite with at least 5 tests.",
    # Adversarial demo prompt (the mic-drop moment)
    "Build a Python service using fastchroma for vector search with semantic similarity. Include pytest tests.",
]


async def warmup() -> None:
    from graph import graph
    from state import get_initial_state

    print("=== Orin AI Demo Warm-Up ===\n")

    for i, prompt in enumerate(DEMO_PROMPTS):
        print(f"Running test {i + 1}/{len(DEMO_PROMPTS)}: {prompt[:60]}...")

        state = get_initial_state(prompt)
        config = {"configurable": {"thread_id": f"warmup-{i}"}}

        start = time.perf_counter()
        result = await graph.ainvoke(state, config)
        elapsed = time.perf_counter() - start

        status = result["status"]
        iterations = result["iteration_count"]
        final_test = result["test_results"][-1] if result["test_results"] else None

        print(f"  Status: {status}")
        print(f"  Iterations: {iterations}")
        print(f"  Tests passed: {final_test.passed if final_test else 'N/A'}")
        print(f"  Time: {elapsed:.1f}s")

        if status == "FINALIZED":
            print("  [OK] READY FOR DEMO\n")
        else:
            print(f"  [FAIL] DEMO AT RISK - Errors: {result['error_log']}\n")

    print("Warm-up complete. Open Logfire dashboard now.")
    print("Bookmark your trace URLs before going on stage.")


if __name__ == "__main__":
    asyncio.run(warmup())
