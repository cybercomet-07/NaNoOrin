# NaNoOrin / Orin

This repository contains **Orin AI**, an autonomous multi-agent product pipeline (FastAPI backend + optional Next.js UI).

## Canonical product layout

**Deployable application code for the full stack (API + `orin-ai/frontend`) lives under [`orin-ai/`](orin-ai/).**  
The default integration branch for that layout is **`main`**.

- **Backend:** [`orin-ai/backend/`](orin-ai/backend/) — FastAPI (`main.py`), LangGraph pipeline, pytest under `tests/`.
- **Frontend:** [`orin-ai/frontend/`](orin-ai/frontend/) — Next.js app (when present in this branch).
- **Compose:** [`orin-ai/docker-compose.yml`](orin-ai/docker-compose.yml) — backend, frontend, Redis.

Other branches (for example **`Master`**) may use a **different layout** than `orin-ai/`. **Do not merge incompatible trees** without an explicit migration plan. See [**CONTRIBUTING.md**](CONTRIBUTING.md) for branch policy and CI expectations.

**Docs:** [orin-ai/README.md](orin-ai/README.md) (product overview, API table, setup).
