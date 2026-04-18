"""
Orin AI — Production FastAPI Server
Phase 5: PROMPT 5.1

Endpoints:
  POST  /run               → start a pipeline run
  GET   /stream/{run_id}   → SSE live event stream
  GET   /status/{run_id}   → polling fallback
  GET   /artifacts/{run_id}→ download generated code files
  GET   /trace/{run_id}    → Logfire trace URL
  GET   /health            → service health check
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone

import logfire
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# ---------------------------------------------------------------------------
# Phase 1 — state (COMPLETE)
# ---------------------------------------------------------------------------
from state import get_initial_state

# ---------------------------------------------------------------------------
# Phase 2 — E2B + Tavily health checks (COMPLETE)
# ---------------------------------------------------------------------------
from tools.e2b_tools import validate_e2b_connection
from tools.tavily_tools import validate_tavily_connection

# ---------------------------------------------------------------------------
# Phase 4 — compiled LangGraph pipeline (COMPLETE)
# ---------------------------------------------------------------------------
from graph import graph

# ---------------------------------------------------------------------------
# App + middleware
# ---------------------------------------------------------------------------
logfire.configure()

app = FastAPI(title="Orin AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logfire.instrument_fastapi(app)

# ---------------------------------------------------------------------------
# In-memory run stores
# ---------------------------------------------------------------------------
run_queues: dict[str, asyncio.Queue] = {}
run_states: dict[str, str] = {}
run_artifacts: dict[str, dict] = {}
run_timestamps: dict[str, float] = {}

# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------
class RunRequest(BaseModel):
    prompt: str


# ---------------------------------------------------------------------------
# Helper — structured SSE event
# ---------------------------------------------------------------------------
def make_event(
    event_type: str,
    agent: str = "",
    task_id: str = "",
    iteration: int = 0,
    payload: dict | None = None,
    status: str = "",
) -> dict:
    return {
        "event_type": event_type,
        "agent": agent,
        "task_id": task_id,
        "iteration": iteration,
        "payload": payload or {},
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /run — start a pipeline run (non-blocking)
# ---------------------------------------------------------------------------
@app.post("/run")
async def run(body: RunRequest):
    """
    Accepts {"prompt": str}.
    Creates a run_id, fires execute_pipeline() as background task,
    returns {"run_id": str} immediately without waiting.
    """
    run_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()

    run_queues[run_id] = queue
    run_states[run_id] = "RUNNING"
    run_artifacts[run_id] = {}
    run_timestamps[run_id] = time.time()

    asyncio.create_task(execute_pipeline(run_id, body.prompt, queue))

    return {"run_id": run_id}


# ---------------------------------------------------------------------------
# GET /stream/{run_id} — SSE live event stream
# ---------------------------------------------------------------------------
@app.get("/stream/{run_id}")
async def stream(run_id: str):
    """
    Opens an SSE connection.
    Reads events from asyncio.Queue and yields as JSON.
    Sends a keep-alive ping every 30 s so the connection stays open.
    Closes automatically when status reaches FINALIZED or FAILED.
    """
    if run_id not in run_queues:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")

    queue = run_queues[run_id]

    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": ""}
                continue

            yield {"data": json.dumps(event)}

            if event.get("status") in ("FINALIZED", "FAILED"):
                break

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# GET /status/{run_id} — polling fallback
# ---------------------------------------------------------------------------
@app.get("/status/{run_id}")
async def status(run_id: str):
    """Returns current status. Use when SSE connection drops."""
    if run_id not in run_states:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    return {"run_id": run_id, "status": run_states[run_id]}


# ---------------------------------------------------------------------------
# GET /artifacts/{run_id} — download generated code files
# ---------------------------------------------------------------------------
@app.get("/artifacts/{run_id}")
async def artifacts(run_id: str):
    """Returns generated code files. Available after FINALIZED status."""
    if run_id not in run_artifacts:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    return {"run_id": run_id, "files": run_artifacts[run_id]}


# ---------------------------------------------------------------------------
# GET /trace/{run_id} — Logfire trace URL
# ---------------------------------------------------------------------------
@app.get("/trace/{run_id}")
async def trace(run_id: str):
    """Returns Logfire dashboard URL. Open this during demo."""
    if run_id not in run_states:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    return {
        "run_id": run_id,
        "trace_url": f"https://logfire.pydantic.dev/orin-ai/traces/{run_id}",
    }


# ---------------------------------------------------------------------------
# GET /health — service health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    """
    Orin plan: {"status": "ok", "e2b": bool, "tavily": bool}.
    Sandbox + Tavily clients are synchronous — run in a thread pool.
    """
    loop = asyncio.get_event_loop()
    try:
        e2b_ok: bool = await loop.run_in_executor(None, validate_e2b_connection)
    except Exception:
        e2b_ok = False
    try:
        tavily_ok: bool = await loop.run_in_executor(None, validate_tavily_connection)
    except Exception:
        tavily_ok = False

    return {
        "status": "ok",
        "e2b": e2b_ok,
        "tavily": tavily_ok,
    }


# ---------------------------------------------------------------------------
# execute_pipeline — background task that drives LangGraph
# ---------------------------------------------------------------------------
async def execute_pipeline(run_id: str, prompt: str, queue: asyncio.Queue) -> None:
    """
    1. Builds fresh AgentState from get_initial_state() [Phase 1]
    2. Streams through the compiled graph [Phase 4]
    3. Converts each node chunk to an SSE event and pushes to queue
    4. Saves final code_files to run_artifacts [Phase 2 output]
    5. Handles exceptions gracefully — always emits a terminal event
    """
    await queue.put(make_event(
        event_type="status_update",
        agent="system",
        payload={"message": "Pipeline started", "prompt": prompt},
        status="RUNNING",
    ))

    try:
        state = get_initial_state(prompt)
        config = {"configurable": {"thread_id": run_id}}

        last_node_output: dict = {}

        async for chunk in graph.astream(state, config):
            for node_name, node_output in chunk.items():
                if not isinstance(node_output, dict):
                    continue

                last_node_output = node_output

                # Mirror code_files into run_artifacts whenever Developer produces them
                if node_output.get("code_files"):
                    run_artifacts[run_id] = dict(node_output["code_files"])

                event = _node_output_to_event(node_name, node_output)
                await queue.put(event)

        # Determine final status from last node output
        final_status = last_node_output.get("status", "FINALIZED")
        if final_status not in ("FINALIZED", "FAILED", "PANIC"):
            final_status = "FINALIZED"

        run_states[run_id] = final_status
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"message": "Pipeline complete"},
            status=final_status,
        ))

    except Exception as exc:
        logfire.error("pipeline_failed", run_id=run_id, error=str(exc))
        run_states[run_id] = "FAILED"
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"error": str(exc)},
            status="FAILED",
        ))


# ---------------------------------------------------------------------------
# _node_output_to_event — maps LangGraph node output → SSE event
# ---------------------------------------------------------------------------
_AGENT_LABEL: dict[str, str] = {
    "supervisor": "Supervisor",
    "researcher": "Researcher",
    "persona": "Persona",
    "join": "Coordinator",
    "architect": "Architect",
    "developer": "Developer",
    "critic": "Critic",
    "auditor": "Auditor",
    "end_success": "system",
    "end_failed": "system",
}


def _node_output_to_event(node_name: str, node_output: dict) -> dict:
    """
    Converts a raw LangGraph node output dict into a structured SSE event.
    Extracts iteration, task_id, and pipeline status from state fields.
    """
    agent = _AGENT_LABEL.get(node_name, node_name)
    iteration: int = node_output.get("iteration_count", 0)
    task_id: str = node_output.get("current_task_id", "")
    pipeline_status: str = node_output.get("status", "RUNNING")

    if node_name == "developer":
        event_type = "agent_complete"
        test_results = node_output.get("test_results") or []
        last_test = test_results[-1] if test_results else None
        payload: dict = {
            "iteration": iteration,
            "mode": node_output.get("mode", "normal"),
            "test_passed": last_test.passed if last_test else None,
            "stdout_preview": (last_test.stdout[:300] if last_test else ""),
            "stderr_preview": (last_test.stderr[:300] if last_test else ""),
        }

    elif node_name == "critic":
        event_type = "test_result"
        test_results = node_output.get("test_results") or []
        last_test = test_results[-1] if test_results else None
        payload = {
            "passed": last_test.passed if last_test else False,
            "exit_code": last_test.exit_code if last_test else -1,
            "stdout": last_test.stdout[:500] if last_test else "",
            "stderr": last_test.stderr[:500] if last_test else "",
            "error_log": node_output.get("error_log") or [],
        }

    elif node_name == "auditor":
        event_type = "agent_complete"
        payload = {
            "audit_passed": node_output.get("audit_passed", False),
            "audit_report": node_output.get("audit_report") or {},
        }

    elif node_name in ("end_success", "end_failed"):
        event_type = "status_update"
        payload = {
            "final_status": pipeline_status,
            "iteration_count": iteration,
            "audit_passed": node_output.get("audit_passed", False),
        }

    elif node_name == "architect":
        event_type = "agent_complete"
        arch = node_output.get("architecture")
        payload = {
            "architecture_ready": arch is not None,
            "tech_rationale": arch.tech_rationale[:300] if arch else "",
        }

    elif node_name == "supervisor":
        event_type = "agent_complete"
        task_graph = node_output.get("task_graph") or []
        payload = {
            "task_count": len(task_graph),
            "tasks": [
                {"task_id": t.task_id, "agent": t.assigned_agent}
                for t in task_graph
            ],
        }

    else:
        event_type = "agent_complete"
        payload = {"node": node_name}

    return make_event(
        event_type=event_type,
        agent=agent,
        task_id=task_id,
        iteration=iteration,
        payload=payload,
        status=pipeline_status,
    )
