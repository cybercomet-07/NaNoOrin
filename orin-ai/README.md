# Orin AI — Autonomous Product Lifecycle Engine

> One prompt. No human in the loop. Working, tested, audited code in under 10 minutes.

## Status

🚧 **Phase 0 complete — scaffold created. Implementation begins Phase 1.**

---

## What It Builds Autonomously

```
User Prompt
  → Market Research (Tavily + Groq)
  → User Personas (Groq)
  → Architecture Design (Claude claude-sonnet-4)
  → Code Generation + Test Loop (Claude + E2B sandbox)
  → Security Audit (Claude Haiku)
  → Fully tested, audited MVP
```

---

## Architecture — 4 Phases

| Phase | Name | Agents |
|---|---|---|
| 1 | Scout Swarm | Researcher + Persona (parallel fan-out) |
| 2 | Blueprint | Architect |
| 3 | Production Loop | Developer → Critic → (retry or pass) |
| 4 | Security Gate | Auditor → FINALIZED or re-route |

---

## The Six Agents

| Agent | Model | Role | Key Tool |
|---|---|---|---|
| Supervisor | Claude claude-sonnet-4 | Orchestrates TaskGraph | LangGraph routing |
| Researcher | Groq Llama 3 70B | Competitor + market analysis | Tavily search |
| Persona | Groq Llama 3 70B | User persona generation | Groq LLM |
| Architect | Claude claude-sonnet-4 | Docker, DB schema, API spec | Claude LLM |
| Developer | Claude claude-sonnet-4 | Writes + fixes code | E2B sandbox |
| Auditor | Claude Haiku | Security scan | Regex + Claude Haiku |

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
| LLM (fast) | Groq Llama 3 70B |
| LLM (quality) | Anthropic Claude claude-sonnet-4 |
| Frontend | Next.js 14 |

---

## Setup

```bash
git clone https://github.com/cybercomet-07/NaNoOrin
cd NaNoOrin/swarm-os

cp .env.example .env
# Fill in all API keys in .env

cd backend
pip install -r requirements.txt

uvicorn main:app --reload
```

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
