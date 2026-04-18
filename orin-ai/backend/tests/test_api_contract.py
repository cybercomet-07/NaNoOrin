"""HTTP and Pydantic contract tests — no real pipeline, LLM, or E2B (execute_pipeline mocked)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from models import AgentEvent, ArtifactsResponse, HealthResponse, RunResponse, make_event


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    import main as main_module

    async def _noop_execute(run_id: str, prompt: str, queue: object) -> None:
        return None

    monkeypatch.setattr(main_module, "execute_pipeline", _noop_execute)

    with TestClient(main_module.app) as test_client:
        yield test_client


def test_health_matches_schema(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    HealthResponse.model_validate(response.json())


def test_openapi_includes_core_paths(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json().get("paths", {})
    assert "/run" in paths
    assert "/health" in paths
    assert "/stream/{run_id}" in paths
    assert "/artifacts/{run_id}" in paths


def test_post_run_returns_run_response(client: TestClient) -> None:
    response = client.post("/run", json={"prompt": "a" * 12})
    assert response.status_code == 200
    data = RunResponse.model_validate(response.json())
    assert data.run_id


def test_post_run_validation_short_prompt(client: TestClient) -> None:
    response = client.post("/run", json={"prompt": "short"})
    assert response.status_code == 422


def test_make_event_round_trips_agent_event() -> None:
    raw = make_event(
        "status_update",
        "system",
        {"message": "Pipeline started"},
        status="RUNNING",
    )
    AgentEvent.model_validate(raw)


def test_artifacts_unknown_run_returns_404(client: TestClient) -> None:
    response = client.get("/artifacts/00000000-0000-0000-0000-000000000099")
    assert response.status_code == 404


def test_artifacts_after_run_matches_schema(client: TestClient) -> None:
    run = client.post("/run", json={"prompt": "b" * 15})
    assert run.status_code == 200
    run_id = run.json()["run_id"]
    art = client.get(f"/artifacts/{run_id}")
    assert art.status_code == 200
    ArtifactsResponse.model_validate(art.json())
