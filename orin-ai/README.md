# Orin AI — Autonomous Product Lifecycle Engine

## Repository layout (canonical on `main`)

| Path | Role |
|------|------|
| [`backend/`](backend/) | FastAPI service: `POST /run`, `GET /stream/{id}`, `GET /artifacts/{id}`, `GET /health`, etc. |
| [`frontend/`](frontend/) | Next.js UI (proxies to API per app config). |
| [`.env.example`](.env.example) | Copy to `backend/.env`; see comments for **required vs optional** keys. |
| [`docker-compose.yml`](docker-compose.yml) | Local/staging stack: backend + frontend + Redis. |

**Branching:** Treat **`main`** + this **`orin-ai/`** tree as the integrated product unless your team has agreed otherwise. Alternate branch layouts cause merge/rebase conflicts; document any migration in the PR. See the repo root [**CONTRIBUTING.md**](../CONTRIBUTING.md).

## Environments (summary)

| Tier | Typical use | Notes |
|------|-------------|--------|
| **Development** | Local `uvicorn --reload`, optional Redis | `ORIN_SKIP_STARTUP_VALIDATION=1` skips strict env checks (also used in CI). |
| **Staging** | Docker Compose or cloud preview | Real `REDIS_URL`, keys from a secret store; validate startup before demo. |
| **Production** | Managed deploy | **Unset** `ORIN_SKIP_STARTUP_VALIDATION` so missing keys fail fast; point load balancers at **`GET /health`**. |

Full variable list and semantics: [`.env.example`](.env.example).

## One line

One prompt. No human in the loop. Working, tested, audited code in under 10 minutes.

## Status

Backend pipeline (LangGraph + FastAPI + agents), demo warm-up script, and this README are in place for hackathon demo and rehearsal.

---

## What It Builds Autonomously

```
User Prompt
  → Market Research (Tavily + Groq llama-3.3-70b)
  → User Personas (Groq llama-3.1-8b-instant)
  → Architecture Design (Groq llama-3.3-70b)
  → Code Generation + Test Loop (Groq llama-3.3-70b + E2B sandbox)
  → Security Audit (regex + Groq llama-3.1-8b-instant)
  → Fully tested, audited MVP
```

---

## Architecture — 4 Phases

| Phase | Name | Agents |
|---|---|---|
| 1 | Parallel discovery | Researcher + Persona (parallel fan-out) |
| 2 | Blueprint | Architect |
| 3 | Production Loop | Developer → Critic → (retry or pass) |
| 4 | Security Gate | Auditor → FINALIZED or re-route |

---

## The Seven Agents

| Agent | Key | Model | Role | Key Tool |
|---|---|---|---|---|
| Supervisor | `GROQ_API_KEY_1` | llama-3.3-70b-versatile | Orchestrates TaskGraph | LangGraph routing |
| Researcher | `GROQ_API_KEY_1` | llama-3.3-70b-versatile | Competitor + market analysis | Tavily search |
| Architect | `GROQ_API_KEY_2` | llama-3.3-70b-versatile | Docker, DB schema, API spec | Groq |
| Developer | `GROQ_API_KEY_3` | llama-3.3-70b-versatile | Writes + fixes code | E2B sandbox |
| Critic | — | — (heuristics only; no LLM call) | Pass/fail on test output | Test stdout/stderr |
| Persona | `GROQ_API_KEY_4` | llama-3.1-8b-instant | User persona generation | Groq |
| Auditor | `GROQ_API_KEY_4` | llama-3.1-8b-instant | Security scan | Regex + Groq |

---

## Self-Healing Demo

The signature demo moment:

1. Developer writes code using `fastchroma` (library does not exist)
2. E2B sandbox pip install fails → exit_code 1
3. Critic detects failure, appends to error_log
4. Developer retries with full error context injected
5. Developer searches Tavily → finds correct library `chromadb`
6. Rewrites requirements.txt + app.py → tests pass
7. Auditor clears code → `status: FINALIZED`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Orchestration | LangGraph (StateGraph + Send API) |
| Backend | FastAPI + sse-starlette |
| Code Sandbox | E2B Code Interpreter |
| Search | Tavily |
| Observability | Logfire |
| LLM | Groq — `llama-3.3-70b-versatile` (supervisor, researcher, architect, developer, critic); `llama-3.1-8b-instant` (persona, auditor) |
| Frontend | Next.js 14 |

---

## Setup

**Environment files:** The API loads `orin-ai/.env` first, then **`orin-ai/backend/.env`** (so backend-specific values win on duplicates), then the process environment.  
- **Docker Compose** (`docker compose` / `run-demo.sh`): put secrets in **`orin-ai/.env`** (matches `env_file` in compose).  
- **Local `uvicorn` from `backend/`**: either file works; use **`backend/.env`** for overrides per developer.

```bash
cd orin-ai
cp .env.example .env
cp .env.example backend/.env   # optional duplicate; or symlink: ln -sf ../.env backend/.env
# Fill keys in at least one of the above (see .env.example)

cd backend
pip install -r requirements.txt
export ORIN_SKIP_STARTUP_VALIDATION=1   # optional: skip strict startup during dev

uvicorn main:app --reload
```

**Production CORS:** set `ALLOWED_ORIGINS` to your deployed UI origin(s), comma-separated. Localhost remains allowed for development.

### Demo warm-up (run ~30 minutes before going on stage)

With full keys in `backend/.env` and **without** `ORIN_SKIP_STARTUP_VALIDATION` (production-style validation):

```bash
cd backend
python demo_warmup.py
```

Runs two canned prompts (happy path + adversarial `fastchroma` self-heal) and prints status, iterations, and timing. Open Logfire and bookmark trace URLs before the demo.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/run` | Submit a goal prompt, returns `run_id` |
| GET | `/stream/{run_id}` | SSE stream of live agent events |
| GET | `/status/{run_id}` | Polling fallback for current status |
| GET | `/artifacts/{run_id}` | Download generated code files |
| GET | `/trace/{run_id}` | Logfire trace URL |
| GET | `/health` | E2B + Tavily connectivity check |

---

## Cost Per Run

Approximately **$0.05–$0.30 per run** tracked via Logfire token logging.

---

## What Orin AI Is NOT

| Tool | Orin AI difference |
|---|---|
| Cursor / Copilot | Those assist humans. Orin replaces the human for the full build cycle. |
| Devin | Devin is single-agent. Orin is a coordinated multi-agent workforce. |
| ChatGPT + Code Interpreter | No testing, no self-healing, no security audit. |
| n8n / Zapier | Those automate workflows. Orin autonomously creates software products. |
