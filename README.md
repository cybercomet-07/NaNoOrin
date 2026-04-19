# Orin AI

**Describe a website in plain English → get working code, a live preview, and a downloadable project.**

Orin AI is a multi-agent product pipeline that turns natural-language prompts into real, runnable software. For judges: everything you see in the UI is backed by real LLM calls, real generated code, and real artifacts — no mock data, no stubs.

---

## 1. What Orin AI does (60-second pitch)

1. **You type a prompt** (or pick a curated demo prompt).
2. A **static-site fast lane** handles simple single-page prompts in one optimized LLM call — producing `index.html` + `styles.css` + `script.js` with seed content and styling.
3. More complex prompts are routed through a **LangGraph multi-agent pipeline** (Supervisor → Architect → Developer → Critic → Auditor → Readme-generator) with per-agent LLM routing and provider failover.
4. The UI streams events over **SSE**, renders the generated site live in a sandboxed iframe, and saves every run to **History** so you can re-open it, download the `.zip`, or read a labeled **Report**.

Two bonus "extensions" sit alongside the main pipeline:

- **Architecture Studio** — describe a system and get a live-rendered Mermaid diagram (DeepSeek via OpenRouter).
- **Repo Analyzer** — paste a public GitHub URL or a README/plan; Gemini returns a structured project report you can download as `.md` or `.txt`.

---

## 2. Demo path for judges (fastest way to evaluate)

1. Start both servers (see [§5 Run locally](#5-run-locally)).
2. Go to **http://127.0.0.1:3000** and log in with the built-in demo account:

   ```
   Email:    demo@orin.ai
   Password: Orin@Demo2026
   ```

   The Login page shows these credentials with one-click **Autofill** and **Log in with demo account** buttons.

3. From the sidebar, open **Demo Prompts** and pick any of the six curated prompts (e.g. *Coffee Shop Landing*, *Minimalist Gym Website*, *Quote of the Day*). These are tuned to complete reliably in ~30–60 seconds.
4. Watch the run page: the event log streams step-by-step, the **PREVIEW** tab shows the live site, the **CODE** tab shows every generated file.
5. Open **History** → expand any row → inspect the prompt + all files, or click **Download .zip** / **Regenerate** / **Report**.
6. Open the **Report** page to see a labeled report: Status, Elapsed, Files, Pipeline, Original Prompt, Architecture flow diagram, Live Preview, and every generated file — plus a one-click **Download complete project (.zip)**.
7. Try the two extensions:
   - **Architecture** — describe a system, get a live Mermaid diagram you can edit, copy, or export.
   - **Analyzer** — paste `https://github.com/tiangolo/fastapi` or any README, download the generated report as Markdown.

Everything is real. Each row in History corresponds to an actual LLM run and is persisted in `localStorage`.

---

## 3. Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                    │
│   /login  /workspace  /workspace/demo  /workspace/run/[id]  │
│   /workspace/architecture  /workspace/analyze               │
│   /workspace/history  /workspace/report/[id]                │
└────────────────────────────┬────────────────────────────────┘
                             │  same-origin /api/*  (Next rewrites)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│                                                             │
│   POST /run          start a pipeline run                   │
│   GET  /stream/{id}  SSE event stream                       │
│   GET  /artifacts/{id}   generated files                    │
│   POST /chat         site-wide product chatbot              │
│   POST /diagram      Mermaid diagram extension              │
│   POST /analyze      Gemini repo/README analyzer            │
│                                                             │
│   ┌─ Static-site fast lane ──────────────────────────┐      │
│   │  OpenAI gpt-4o-mini → index.html/css/js          │      │
│   └──────────────────────────────────────────────────┘      │
│                                                             │
│   ┌─ LangGraph pipeline ─────────────────────────────┐      │
│   │  Supervisor → Architect → Developer →            │      │
│   │  Critic → Auditor → Readme-generator             │      │
│   │  (provider failover across OpenAI / OpenRouter / │      │
│   │   Groq with per-agent key routing)               │      │
│   └──────────────────────────────────────────────────┘      │
└────────────────┬─────────────────────┬──────────────────────┘
                 │                     │
                 ▼                     ▼
              Redis               E2B Sandbox
          (run status,           (code execution
           artifact cache)        for full pipeline)
```

---

## 4. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Lucide, React Markdown, Mermaid |
| Backend | FastAPI, LangGraph, Pydantic v2, Redis, Logfire (Pydantic) |
| LLMs | OpenAI (`gpt-4o-mini`), OpenRouter (DeepSeek Chat v3.1), Groq (Llama 3.1 8B / 3.3 70B), Gemini (`gemini-2.5-flash`) |
| Tools | E2B Sandbox (code execution), Tavily (search) |
| Infra | Docker Compose, Python 3.12, Node 20+ |

**LLM routing (current):**

| Agent / feature | Primary | Fallback |
|-----------------|---------|----------|
| Developer (fast lane + pipeline) | OpenAI `gpt-4o-mini` | OpenRouter DeepSeek |
| Architect | OpenRouter DeepSeek | OpenRouter `gpt-oss-120b:free` |
| Critic / Auditor / Readme | OpenRouter DeepSeek (dedicated key) | Shared OpenRouter fallback |
| Supervisor / Researcher / Persona / Coordinator | Groq Llama 3.1 8B | OpenRouter DeepSeek |
| Mermaid diagram extension | OpenRouter DeepSeek | OpenRouter `gpt-oss-120b:free` |
| Repo analyzer extension | Gemini 2.5 Flash | Gemini 2.5 Flash Lite |
| Site-wide chatbot | OpenRouter DeepSeek | — |

Every API call is wrapped in a failover loop so one rate limit doesn't kill the demo.

---

## 5. Run locally

### 5.1. Prerequisites

- Python **3.12+**, Node **20+**, a running **Redis** (`redis://localhost:6379`).
- A filled `orin-ai/backend/.env` — copy `orin-ai/.env.example` and fill in the keys. The committed `.env` in this repo already has working demo keys for every provider; nothing extra is required to run the demo.

### 5.2. Two terminals

```powershell
# Terminal 1 — backend (FastAPI on http://127.0.0.1:8000)
cd orin-ai/backend
pip install -r requirements.txt
py -3 -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2 — frontend (Next.js on http://127.0.0.1:3000)
cd orin-ai/frontend
npm install
npm run dev
```

Then open **http://127.0.0.1:3000** and follow [§2 Demo path](#2-demo-path-for-judges-fastest-way-to-evaluate).

### 5.3. Docker Compose (optional)

```bash
cd orin-ai
docker compose up --build
# Frontend on :3000, backend on :8000, Redis on :6379
```

---

## 6. Feature tour (what every screen does)

| Screen | What to show a judge |
|--------|---------------------|
| **Login** (`/login`) | Demo credentials card · one-click login · idempotent demo-user seeding in `localStorage`. |
| **Demo Prompts** (`/workspace/demo`) | Six curated prompts that are guaranteed to complete. Each forces the static-site fast lane. |
| **Workspace** (`/workspace`) | Free-form prompt input. |
| **Run** (`/run/[id]`) | Live event log (step-wise), chat with the pipeline, CODE / PREVIEW / LOGS tabs, terminal output, retry via "do it again". |
| **Architecture Studio** (`/workspace/architecture`) | Plain-English → live-rendered Mermaid diagram. Edit, copy, or export `.mmd`. |
| **Repo Analyzer** (`/workspace/analyze`) | Paste a public GitHub URL **or** raw README/plan text → Gemini returns a labeled report with sections 1–8 (Summary, Tech Stack, Architecture, Features, Strengths, Risks, Next Steps, Quality Score). Download as `.md` or `.txt`. |
| **History** (`/workspace/history`) | Every run you've done — searchable, expandable rows showing the prompt and all generated files, per-row Regenerate / Download `.zip` / Delete, top-level Clear All. |
| **Reports** (`/workspace/report/[id]`) | Labeled 5-section report: Summary · Prompt · Architecture flow · Live Preview · Generated Code. Single-click `.zip` download of the entire project. |
| **Settings** (`/workspace/settings`) | Real account info, real LLM routing for this build, real local-data controls. No fake data. |
| **Site-wide chatbot** | Floating bubble on every page except `/run/[id]`; answers questions about Orin AI via OpenRouter. |

---

## 7. API reference (FastAPI)

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/run`               | Start a pipeline run. Body: `{ prompt, force_static_site? }` |
| GET    | `/stream/{run_id}`   | SSE event stream for that run |
| GET    | `/status/{run_id}`   | Polling-friendly status snapshot |
| GET    | `/artifacts/{run_id}`| Generated files for a finished run |
| GET    | `/trace/{run_id}`    | Full LangGraph trace |
| GET    | `/health`            | Liveness + configured providers |
| POST   | `/chat`              | Site-wide chatbot (OpenRouter DeepSeek) |
| POST   | `/diagram`           | Natural-language → Mermaid source |
| POST   | `/analyze`           | Repo URL or pasted text → structured Gemini report |

See [`orin-ai/README.md`](orin-ai/README.md) for deeper operator / deployment notes.

---

## 8. Repository layout

```
orin-ai/
├── backend/                  # FastAPI + LangGraph pipeline
│   ├── main.py               # App entry; /run, /stream, /chat, /health, …
│   ├── analyzer.py           # POST /analyze — Gemini repo analyzer
│   ├── diagram.py            # POST /diagram — Mermaid extension
│   ├── llm_clients.py        # Per-agent LLM routing + failover
│   ├── static_site_fastlane.py
│   ├── agents/               # Supervisor, Architect, Developer, …
│   ├── graph.py              # LangGraph wiring
│   └── tests/                # Pytest suite
├── frontend/                 # Next.js 16 UI
│   ├── app/
│   │   ├── login/
│   │   ├── workspace/
│   │   │   ├── demo/
│   │   │   ├── architecture/
│   │   │   ├── analyze/      # Repo Analyzer extension
│   │   │   ├── history/
│   │   │   ├── report/[id]/
│   │   │   └── settings/
│   │   └── run/[id]/
│   ├── components/           # Sidebar, SiteChatbot, PipelineWorkspace, …
│   └── lib/                  # analyze.ts, diagram.ts, runHistory.ts, zip.ts, …
├── docker-compose.yml
└── README.md                 # (detailed ops doc)
```

---

## 9. What makes this project demo-ready

- **Every button works.** History, Reports, Analyzer, Architecture — every Copy, Download, Regenerate, Delete, and Open action is wired end-to-end.
- **No mock data anywhere.** Settings shows the real session. History reads from real runs. Reports render the real generated code in a real sandboxed iframe.
- **Static-site fast lane** lets the six demo prompts finish in one reliable LLM call with seeded content, so judges see polished output — not empty cards.
- **Provider failover** across OpenAI → OpenRouter → Groq → Gemini means one dead key doesn't break the demo.
- **Zero-dependency `.zip` download** — any generated project can be exported from the browser without a server round-trip.
- **Full observability** via Logfire spans on every LLM call, agent invocation, and extension request.

---

## 10. Credits & license

Built by **cybercomet-07** on the `main` branch of [`cybercomet-07/NaNoOrin`](https://github.com/cybercomet-07/NaNoOrin). Licensed for evaluation and demonstration use.
