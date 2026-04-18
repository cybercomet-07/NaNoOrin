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
  → Market Research (Tavily + Groq)
  → User Personas (Gemini Flash-Lite)
  → Architecture Design (Gemini Flash)
  → Code Generation + Test Loop (Gemini Flash + E2B sandbox)
  → Security Audit (regex + Gemini Flash-Lite)
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

| Agent | Model | Role | Key Tool |
|---|---|---|---|
| Supervisor | Gemini Flash | Orchestrates TaskGraph | LangGraph routing |
| Researcher | Groq Llama 3.3 70B | Competitor + market analysis | Tavily search |
| Persona | Gemini Flash-Lite | User persona generation | Gemini API |
| Architect | Gemini Flash | Docker, DB schema, API spec | Gemini API |
| Developer | Gemini Flash | Writes + fixes code | E2B sandbox |
| Critic | — (heuristics) | Pass/fail on test output | Test stdout/stderr |
| Auditor | Gemini Flash-Lite | Security scan | Regex + Gemini API |

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
| LLM (fast) | Groq Llama 3.3 70B (researcher) |
| LLM (quality) | Google Gemini Flash / Flash-Lite (OpenAI-compatible API) |
| Frontend | Next.js 14 |

---

## Setup

```bash
cd orin-ai
cp .env.example backend/.env
# Fill in all API keys in backend/.env (see .env.example)

cd backend
pip install -r requirements.txt

uvicorn main:app --reload
```

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
