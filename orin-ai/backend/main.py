"""
Orin AI — Production FastAPI Server
Phase 5: PROMPT 5.1 · Phase 8: hardening

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
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, cast

from dotenv import load_dotenv

# Load env before imports that read os.environ. Parent `orin-ai/.env` first, then
# `backend/.env` overrides (Compose usually injects via env_file; files optional locally).
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir.parent / ".env")
load_dotenv(_backend_dir / ".env")
load_dotenv()

import logfire
import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from debug_session_log import dbg
from models import (
    ArtifactsResponse,
    HealthResponse,
    RunRequest,
    RunResponse,
    StatusResponse,
    TraceResponse,
    make_event,
)

_StatusLiteral = Literal["RUNNING", "FAILED", "PANIC", "FINALIZED", "UNKNOWN"]

# ---------------------------------------------------------------------------
# Phase 8.2 — fail fast on missing keys / broken E2B (set ORIN_SKIP_STARTUP_VALIDATION=1 to skip)
# ---------------------------------------------------------------------------
if os.getenv("ORIN_SKIP_STARTUP_VALIDATION") != "1":
    from startup_check import validate_environment

    validate_environment()

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
# Logfire + run stores
# ---------------------------------------------------------------------------
logfire.configure()

# Queues stay in-memory: asyncio.Queue cannot be serialised to Redis
run_queues: dict[str, asyncio.Queue] = {}
# Background pipeline tasks (for SSE timeout / stuck detection)
_pipeline_tasks: dict[str, asyncio.Task[None]] = {}
# Limit concurrent runs (DoS / quota protection)
_MAX_RUNS = max(1, int(os.getenv("ORIN_MAX_CONCURRENT_RUNS", "5")))
_run_semaphore = asyncio.Semaphore(_MAX_RUNS)
_QUEUE_DRAIN_SEC = max(0, int(os.getenv("ORIN_QUEUE_DRAIN_SEC", "15")))
_SSE_MAX_SEC = max(60, int(os.getenv("ORIN_SSE_MAX_SEC", "1800")))

# Redis client — set during lifespan startup
_redis: aioredis.Redis | None = None

_RUN_TTL = 7200  # 2 hours


async def _set_status(run_id: str, status: str) -> None:
    if _redis:
        await _redis.setex(f"status:{run_id}", _RUN_TTL, status)


async def _get_status(run_id: str) -> str:
    if _redis:
        val = await _redis.get(f"status:{run_id}")
        return val or "UNKNOWN"
    return "UNKNOWN"


async def _set_artifacts(run_id: str, artifacts: dict) -> None:
    if _redis:
        await _redis.setex(f"artifacts:{run_id}", _RUN_TTL, json.dumps(artifacts))


async def _get_artifacts(run_id: str) -> dict:
    if _redis:
        data = await _redis.get(f"artifacts:{run_id}")
        return json.loads(data) if data else {}
    return {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _redis
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    try:
        _redis = aioredis.from_url(redis_url, decode_responses=True)
        await _redis.ping()
        sys.stdout.buffer.write(f"[OK] Redis connected: {redis_url}\n".encode("utf-8"))
        sys.stdout.buffer.flush()
    except Exception as exc:
        sys.stdout.buffer.write(f"[WARN] Redis unavailable ({exc}). Run state will not persist across restarts.\n".encode("utf-8"))
        sys.stdout.buffer.flush()
        _redis = None
    yield
    if _redis:
        await _redis.aclose()


app = FastAPI(title="Orin AI", version="1.0.0", lifespan=lifespan)

# CORS: local dev matches localhost:any port. Production: set ALLOWED_ORIGINS to your UI
# origins (comma-separated), e.g. https://app.example.com,https://www.example.com
_extra_cors = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
_MAX_BODY_RUN = int(os.getenv("ORIN_MAX_RUN_BODY_BYTES", "65536"))


@app.middleware("http")
async def limit_run_body_size(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/run":
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > _MAX_BODY_RUN:
                    return JSONResponse(
                        {"detail": "Request body too large"},
                        status_code=413,
                    )
            except ValueError:
                pass
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_extra_cors,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    with logfire.span("http_request", request_id=request_id, path=request.url.path):
        response = await call_next(request)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(
            {"detail": exc.detail},
            status_code=exc.status_code,
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse({"detail": exc.errors()}, status_code=422)
    logfire.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        {"error": "Internal error", "detail": "An unexpected error occurred."},
        status_code=500,
    )


logfire.instrument_fastapi(app)

from llm_clients import validate_all_keys

validate_all_keys()


def _normalize_status(raw: str) -> _StatusLiteral:
    allowed: frozenset[str] = frozenset({"RUNNING", "FAILED", "PANIC", "FINALIZED", "UNKNOWN"})
    return cast(_StatusLiteral, raw if raw in allowed else "UNKNOWN")


# ---------------------------------------------------------------------------
# POST /run — start a pipeline run (non-blocking)
# ---------------------------------------------------------------------------
@app.post("/run", response_model=RunResponse)
async def run(body: RunRequest):
    """
    Accepts {"prompt": str}.
    Creates a run_id, fires execute_pipeline() as background task,
    returns {"run_id": str} immediately without waiting.
    """
    await _run_semaphore.acquire()
    run_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    run_queues[run_id] = queue
    await _set_status(run_id, "RUNNING")

    async def _run_with_cleanup() -> None:
        try:
            await execute_pipeline(run_id, body.prompt, queue)
        finally:
            _run_semaphore.release()
            if _QUEUE_DRAIN_SEC:
                await asyncio.sleep(_QUEUE_DRAIN_SEC)
            run_queues.pop(run_id, None)
            _pipeline_tasks.pop(run_id, None)

    t = asyncio.create_task(_run_with_cleanup())
    _pipeline_tasks[run_id] = t

    def _log_task_errors(task: asyncio.Task[None]) -> None:
        try:
            exc = task.exception()
            if exc is not None:
                logfire.error("pipeline_task_failed", run_id=run_id, error=str(exc))
        except asyncio.CancelledError:
            pass

    t.add_done_callback(_log_task_errors)

    return RunResponse(run_id=run_id)


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
    deadline = time.monotonic() + _SSE_MAX_SEC

    async def event_generator():
        while True:
            if time.monotonic() > deadline:
                yield {
                    "data": json.dumps(
                        make_event(
                            event_type="status_update",
                            agent="system",
                            payload={"message": "Stream timed out"},
                            status="FAILED",
                        )
                    )
                }
                break
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
@app.get("/status/{run_id}", response_model=StatusResponse)
async def status(run_id: str):
    """Returns current status. Use when SSE connection drops."""
    current = await _get_status(run_id)
    if current == "UNKNOWN" and run_id not in run_queues:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    norm = _normalize_status(current)
    return StatusResponse(
        run_id=run_id,
        status=norm,
        iteration_count=0,
        agents_completed=[],
        elapsed_seconds=None,
    )


# ---------------------------------------------------------------------------
# GET /artifacts/{run_id} — download generated code files
# ---------------------------------------------------------------------------
@app.get("/artifacts/{run_id}", response_model=ArtifactsResponse)
async def artifacts(run_id: str):
    """Returns generated code files. Available after FINALIZED status."""
    files = await _get_artifacts(run_id)
    current_status = await _get_status(run_id)
    if current_status == "UNKNOWN" and run_id not in run_queues:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    norm = _normalize_status(current_status)
    code_files: dict[str, str] = {k: str(v) for k, v in files.items()} if isinstance(files, dict) else {}
    return ArtifactsResponse(
        run_id=run_id,
        files=code_files,
        total_files=len(code_files),
        test_passed=norm == "FINALIZED",
        audit_passed=norm == "FINALIZED",
    )


# ---------------------------------------------------------------------------
# GET /trace/{run_id} — Logfire trace URL
# ---------------------------------------------------------------------------
@app.get("/trace/{run_id}", response_model=TraceResponse)
async def trace(run_id: str):
    """Returns Logfire dashboard URL. Open this during demo."""
    current = await _get_status(run_id)
    if current == "UNKNOWN" and run_id not in run_queues:
        raise HTTPException(status_code=404, detail=f"run_id {run_id!r} not found")
    project = os.getenv("LOGFIRE_PROJECT", "orin-ai")
    return TraceResponse(
        run_id=run_id,
        trace_url=f"https://logfire.pydantic.dev/{project}/traces/{run_id}",
        logfire_project=project,
    )


# ---------------------------------------------------------------------------
# GET /health — service health check
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health():
    """
    Orin plan: {"status": "ok", "e2b": bool, "tavily": bool, "redis": bool}.
    Sandbox + Tavily clients are synchronous — run in a thread pool.
    """
    loop = asyncio.get_running_loop()
    try:
        e2b_ok: bool = await loop.run_in_executor(None, validate_e2b_connection)
    except Exception:
        e2b_ok = False
    try:
        tavily_ok: bool = await loop.run_in_executor(None, validate_tavily_connection)
    except Exception:
        tavily_ok = False
    try:
        redis_ok: bool = _redis is not None and bool(await _redis.ping())
    except Exception:
        redis_ok = False

    return HealthResponse(
        status="ok",
        e2b_connected=e2b_ok,
        tavily_connected=tavily_ok,
        redis_connected=redis_ok,
        version="1.0.0",
    )


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

                # Mirror code_files into Redis whenever Developer produces them
                if node_output.get("code_files"):
                    await _set_artifacts(run_id, dict(node_output["code_files"]))

                event = _node_output_to_event(node_name, node_output)
                await queue.put(event)

        # Determine final status from last node output
        final_status = last_node_output.get("status", "FINALIZED")
        if final_status not in ("FINALIZED", "FAILED", "PANIC"):
            final_status = "FINALIZED"

        await _set_status(run_id, final_status)
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"message": "Pipeline complete"},
            status=final_status,
        ))

    except Exception as exc:
        # region agent log
        try:
            import traceback

            dbg(
                "H2",
                "main.py:execute_pipeline",
                "pipeline_uncaught",
                {
                    "exc_type": type(exc).__name__,
                    "msg": str(exc)[:900],
                    "tb_tail": traceback.format_exc()[-2500:],
                },
                run_id,
            )
        except Exception:
            pass
        # endregion
        logfire.error("pipeline_failed", run_id=run_id, error=str(exc))
        await _set_status(run_id, "FAILED")
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"error": "Pipeline failed"},
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
    "readme_generator": "Readme",
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

    elif node_name == "readme_generator":
        event_type = "agent_complete"
        cf = node_output.get("code_files") or {}
        readme = cf.get("README.md", "")
        payload = {
            "readme_generated": "README.md" in cf,
            "readme_preview": readme[:400] if readme else "",
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
