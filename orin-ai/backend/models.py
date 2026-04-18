"""Pydantic request/response models for Orin AI FastAPI (GAP 3 — Orin_plan_updated)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


def _utc_iso_z() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ── Request models ─────────────────────────────────────────────────────────────


class RunRequest(BaseModel):
    model_config = ConfigDict(json_schema_extra={"examples": [{"prompt": "Build a FastAPI REST API for a task manager with JWT auth and PostgreSQL"}]})

    prompt: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Natural language goal for Orin AI to build",
    )


# ── Response models ────────────────────────────────────────────────────────────


class RunResponse(BaseModel):
    run_id: str
    status: str = "RUNNING"
    message: str = "Pipeline started. Connect to /stream/{run_id} for live events."


class StatusResponse(BaseModel):
    run_id: str
    status: Literal["RUNNING", "FAILED", "PANIC", "FINALIZED", "UNKNOWN"]
    iteration_count: int = 0
    agents_completed: list[str] = Field(default_factory=list)
    elapsed_seconds: Optional[float] = None


class ArtifactsResponse(BaseModel):
    run_id: str
    files: dict[str, str]
    total_files: int
    test_passed: bool
    audit_passed: bool


class TraceResponse(BaseModel):
    run_id: str
    trace_url: str
    logfire_project: str


class HealthResponse(BaseModel):
    status: str
    e2b_connected: bool
    tavily_connected: bool
    redis_connected: bool
    version: str = "1.0.0"


# ── SSE event models ───────────────────────────────────────────────────────────


class AgentEvent(BaseModel):
    """Schema for SSE events on /stream/{run_id}."""

    event_type: Literal["agent_start", "agent_complete", "test_result", "status_update"]
    agent: str = ""
    task_id: str = ""
    iteration: int = 0
    payload: dict[str, Any] = Field(default_factory=dict)
    status: str = ""
    timestamp: str = Field(default_factory=_utc_iso_z)


def make_event(
    event_type: str,
    agent: str,
    payload: dict[str, Any] | None = None,
    task_id: str = "",
    iteration: int = 0,
    status: str = "",
) -> dict[str, Any]:
    """Build a structured SSE event dict ready for json.dumps()."""
    ev = AgentEvent(
        event_type=event_type,  # validated against Literal at runtime
        agent=agent,
        task_id=task_id,
        iteration=iteration,
        payload=payload or {},
        status=status,
    )
    return ev.model_dump()
