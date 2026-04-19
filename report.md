# Orin / NaNoOrin — project report (handoff)

This document is for **anyone joining the repo** (including a new coding agent): what exists today, how it fits together, what is **not** done, and sensible **next steps**.

---

## 1. Executive summary

- **Product vision:** An autonomous multi-agent pipeline: one user prompt → research + personas → architecture → code/tests in E2B → audit — exposed via **FastAPI** and a **Next.js** UI under **`orin-ai/frontend`**.
- **Canonical deployable stack** for the hackathon/product described in docs lives under **`orin-ai/`** (backend + frontend + Compose). **`main` has no second root-level Next.js app** (that duplicate was removed to avoid confusion).

---

## 2. Repository layout (what lives where)

### 2.1 Root (`/`)

| Area | Purpose |
|------|---------|
| `README.md` | Points contributors to **`orin-ai/`** as canonical full-stack product code. |
| `CONTRIBUTING.md` | Branch policy (`main`), git tips, modify/delete conflict guidance, local commands matching CI. |
| `report.md` | This file. |
| `.github/workflows/ci.yml` | CI: **`orin-ai/backend`** pytest, **`orin-ai/frontend`** lint+build, Docker Compose validate. |

### 2.2 `orin-ai/` — canonical API + integrated UI

| Path | Role |
|------|------|
| `backend/` | **FastAPI** app (`main.py`): `POST /run`, `GET /stream/{run_id}`, `GET /status/{run_id}`, `GET /artifacts/{run_id}`, `GET /trace/{run_id}`, `GET /health`. Redis-backed run state/artifacts where implemented. |
| `backend/graph.py` | **LangGraph** `StateGraph`: supervisor + conditional edges for fan-out (research + persona in parallel). **Important:** fan-out uses **conditional edges**, not returning `Send` from a node (LangGraph 1.x expectation). |
| `backend/agents/` | Supervisor, researcher, persona, architect, developer, critic, auditor, readme generator, `safe_nodes` helpers. |
| `backend/tools/` | Tavily, E2B wrappers. |
| `backend/tests/` | `test_pipeline.py`, `test_api_contract.py`, `test_self_healing.py` (live self-healing behind env flag), `conftest.py`. |
| `backend/startup_check.py` | Validates env/services when not skipped. |
| `frontend/` | **Next.js** client for the pipeline (proxies/API URL via env — see Dockerfile + `next.config.ts`). |
| `docker-compose.yml` | **redis** + **backend** + **frontend**; `BACKEND_URL` build args for in-network API URL. |
| `.env.example` | Template for **`backend/.env`** (copy path documented in `orin-ai/README.md`). Lists `GROQ_API_KEY_1`–`4` (see routing in `llm_clients.py`), Tavily, E2B, Logfire, Redis, `ORIN_SKIP_STARTUP_VALIDATION`, optional live tests. |
| `run-demo.sh` | Bash helper: checks Docker + `.env`, picks free host port 3000–3003, runs Compose. |

### 2.3 Secrets and local files (do not commit)

- **`orin-ai/.env`** — often used by Compose (`env_file`); must stay **gitignored** or out of VCS (real keys).
- **`orin-ai/backend/.env`** — per README copy-from-example flow; treat as secret.
- `.gitignore` at root covers `__pycache__`, `orin-ai/backend/.env`, frontend `node_modules`/`.next`, etc.

---

## 3. Backend behavior (high level)

- **Orchestration:** LangGraph with shared **state** (`state.py`) and **models** (`models.py`) for API contracts.
- **Phases (conceptual):** parallel discovery (researcher + persona) → architect → developer/critic loop → auditor (and readme generation where wired).
- **External services:** Groq (all LLM agents per fixed key/model map in `llm_clients.py`), Tavily (search), E2B (sandbox), Logfire (telemetry), Redis (persistence for runs when configured).
- **Health:** `GET /health` reports connectivity flags (e.g. E2B/Tavily probes may be false if keys/network fail); **`status: "ok"`** still means the API process is up — interpret fields carefully for demos.

---

## 4. CI (what is automatically verified)

On push/PR to `main` / `master` / `Master`:

1. **Backend:** `pip install -r requirements.txt` in `orin-ai/backend`, `ORIN_SKIP_STARTUP_VALIDATION=1`, `pytest -q`.
2. **Frontend (orin-ai only):** `npm ci`, `npm run lint`, `npm run build` in `orin-ai/frontend`.
3. **Compose:** `docker compose -f orin-ai/docker-compose.yml config -q` with empty `orin-ai/.env` created in CI.

---

## 5. Git / branch history notes (context for agents)

- **`main`** was at times **force-pushed** from upstream; an extra **root-level** Next.js tree was merged in briefly and later **removed** so only **`orin-ai/frontend`** remains as the web UI.
- **`Master`** (capital M) may still exist remotely with a different history — treat as **legacy** unless the team agrees otherwise (`CONTRIBUTING.md`).
- Rebasing a long `orin-ai`-only history onto a remote that deleted `orin-ai/` causes **modify/delete** conflicts; **merge** + explicit keep of `orin-ai/` was used to reconcile.

---

## 6. What is done (working themes)

- FastAPI routes and SSE streaming surface for runs.
- LangGraph pipeline with supervisor routing and parallel research/persona fan-out pattern aligned with current LangGraph expectations.
- Docker Compose for local demo; `run-demo.sh` for port fallback and one-command bring-up.
- CORS / proxy story for Next talking to API (including Docker internal `BACKEND_URL` — see recent commits touching `main.py`, `docker-compose.yml`, frontend Docker/build).
- Contract tests (`test_api_contract.py`) and contributing docs for API evolution.
- Pytest suite for pipeline pieces; self-healing tests gated behind env.

---

## 6.1 Connectivity audit (what is wired)

| Link | Status |
|------|--------|
| **Frontend → API** | Next.js rewrites `/api/*` → `BACKEND_URL` (Docker: `http://backend:8000`). Browser uses same-origin `/api/run`, `/api/stream/{id}`, `/api/artifacts/{id}`. |
| **Compose** | `orin-ai/.env` → backend container; frontend build gets `BACKEND_URL` for rewrites. |
| **Backend env** | `main.py` loads `backend/.env` then `orin-ai/.env` so Compose and local uvicorn agree. |
| **CORS** | Regex allows `localhost` / `127.0.0.1` on any port; optional `ALLOWED_ORIGINS` for deployed UI hostnames. |
| **Redis** | Optional: API runs if Redis down; run state/artifacts then do not persist. |
| **CI** | Backend pytest + frontend lint/build + compose validate — matches `orin-ai/` tree. |

## 7. What is remaining / open gaps

| Area | Gap |
|------|-----|
| **E2E tests** | No Playwright/Cypress; add when stack is stable. |
| **Auth / abuse** | `POST /run` is unauthenticated — add API keys or OAuth before public internet exposure. |
| **Rate limits** | No per-IP or global throttling on `/run` or SSE. |
| **Dependabot** | Optional. |
| **Plans / docs** | Old plan files may only exist in git history. |
| **Secrets** | Use a secret manager in production; never commit `.env`. |
| **Observability** | Invalid `LOGFIRE_TOKEN` causes noise or failures depending on version. |
| **Key hygiene** | Tavily/E2B/Groq must be valid for full pipeline demos. |

---

## 8. Suggested next steps (priority order)

1. **Single env doc:** One table: “local bare metal”, “Docker Compose”, “CI” for `NEXT_PUBLIC_*`, `BACKEND_URL`, and API origin.
2. **Smoke test:** `cd orin-ai && ./run-demo.sh` (or documented `docker compose up`) + one pipeline run before demos.
3. **Optional:** E2E happy path; Dependabot; restore planning markdown from git if the team still uses it.

---

## 9. Quick commands reference

```bash
# Backend tests (match CI)
cd orin-ai/backend && export ORIN_SKIP_STARTUP_VALIDATION=1 && pip install -r requirements.txt && pytest -q

# orin-ai frontend (match CI)
cd orin-ai/frontend && npm ci && npm run lint && npm run build

# Compose file check (match CI)
touch orin-ai/.env && docker compose -f orin-ai/docker-compose.yml config -q

# Docker demo (needs real orin-ai/.env)
cd orin-ai && ./run-demo.sh
```

---

## 10. For a new agent — read first

1. Root **`README.md`** + **`orin-ai/README.md`**
2. **`CONTRIBUTING.md`** (workflow + contract tests pointer)
3. **`orin-ai/.env.example`**
4. **`orin-ai/backend/main.py`** (routes) and **`orin-ai/backend/graph.py`** (orchestration)
5. **`.github/workflows/ci.yml`** (what must stay green)

When changing API shapes or SSE events, update **`test_api_contract.py`** and **`orin-ai/frontend`** consumers.

---

*Amend this file when the canonical layout or CI scope changes.*
