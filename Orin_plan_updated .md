# Orin AI — Build Prompts ADDENDUM
> Everything missing from v1. Append these to your build sequence.
> Covers: Docker, shared LLM utils, message truncation, Groq fallback,
> Pydantic models, join node, README agent, full frontend, correction directive.

---

## GAP 1 — LOCAL DEV INFRASTRUCTURE

### PROMPT G1.1 — docker-compose.yml (Local Dev)
```
Create docker-compose.yml in the root swarm-os/ directory for local development.

This is the local dev environment only — NOT the docker-compose the Architect agent generates for user projects.

version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    depends_on:
      - redis
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:

---

Also create backend/Dockerfile:

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

---

Also create frontend/Dockerfile:

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

---

Also create .dockerignore in both backend/ and frontend/ directories:

backend/.dockerignore:
__pycache__
*.pyc
.env
venv/
.pytest_cache/
*.egg-info/

frontend/.dockerignore:
node_modules/
.next/
.env.local
```

---

### PROMPT G1.2 — Redis Integration for Run State Persistence
```
Update backend/main.py to use Redis for run state persistence instead of in-memory dicts.

WHY: In-memory dicts reset on server restart. During a hackathon demo, if the server crashes
mid-run and restarts, all run state is lost. Redis survives restarts.

Install: pip install redis[asyncio] (add to requirements.txt)

Replace the in-memory dicts with Redis:

import redis.asyncio as aioredis

# Replace these:
# run_queues: dict[str, asyncio.Queue] = {}
# run_states: dict[str, str] = {}
# run_artifacts: dict[str, dict] = {}
# run_timestamps: dict[str, float] = {}

# With Redis client:
redis_client: aioredis.Redis = None

@app.on_event("startup")
async def startup():
    global redis_client
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = aioredis.from_url(redis_url, decode_responses=True)
    await redis_client.ping()
    print("✅ Redis connected")

@app.on_event("shutdown")
async def shutdown():
    await redis_client.close()

# Helper functions to replace dict access:

async def set_run_status(run_id: str, status: str):
    await redis_client.setex(f"status:{run_id}", 7200, status)  # 2hr TTL

async def get_run_status(run_id: str) -> str:
    return await redis_client.get(f"status:{run_id}") or "UNKNOWN"

async def set_run_artifacts(run_id: str, artifacts: dict):
    await redis_client.setex(f"artifacts:{run_id}", 7200, json.dumps(artifacts))

async def get_run_artifacts(run_id: str) -> dict:
    data = await redis_client.get(f"artifacts:{run_id}")
    return json.loads(data) if data else {}

# Keep asyncio.Queue IN MEMORY (queues can't be Redis-serialized):
run_queues: dict[str, asyncio.Queue] = {}

Add REDIS_URL=redis://localhost:6379 to .env.example
```

---

## GAP 2 — SHARED LLM UTILITY (CRITICAL MISSING PIECE)

### PROMPT G2.1 — Shared LLM Client & Message Truncation
```
Create backend/utils/llm_client.py for Orin AI.

This is the SINGLE place all LLM calls go through. Every agent MUST use this — never call
anthropic.Anthropic() or groq.Groq() directly in agent files.

WHY: The PDF explicitly warns that sending full message history causes silent context window
truncation on long runs. This utility enforces the 6-8 turn truncation rule everywhere.

import anthropic
import openai
import groq
import logfire
import os
import time
from typing import Literal

# Model aliases matching the PDF spec
MODELS = {
    "supervisor":  "claude-sonnet-4-20250514",   # Claude Sonnet — pure reasoning
    "architect":   "claude-sonnet-4-20250514",   # Claude Sonnet — most prompt-sensitive
    "developer":   "claude-sonnet-4-20250514",   # Claude Sonnet — primary coder
    "auditor":     "claude-haiku-4-5-20251001",  # Claude Haiku — fast scanner
    "researcher":  "llama3-70b-8192",            # Groq — fast + cheap
    "persona":     "llama3-70b-8192",            # Groq — fast + cheap
    "fallback":    "gpt-4o-mini",                # OpenAI — Groq rate-limit fallback
}

MAX_HISTORY_TURNS = 6  # PDF: "truncate messages[] to last 6-8 turns"

def truncate_messages(messages: list[dict], max_turns: int = MAX_HISTORY_TURNS) -> list[dict]:
    """
    CRITICAL: Enforces the PDF's message truncation rule.
    Always keep: system message (index 0) + last N user/assistant pairs.
    Without this, long runs hit context limits and fail silently.
    """
    if not messages:
        return messages
    
    # Separate system messages from conversation
    system_msgs = [m for m in messages if m.get("role") == "system"]
    convo_msgs  = [m for m in messages if m.get("role") != "system"]
    
    # Keep only last max_turns messages from conversation
    truncated_convo = convo_msgs[-(max_turns * 2):]  # *2 because user+assistant pairs
    
    return system_msgs + truncated_convo


def call_claude(
    agent_name: str,
    system_prompt: str,
    user_message: str,
    messages_history: list[dict] = None,
    max_tokens: int = 4096,
) -> str:
    """
    Call Claude (Anthropic) for Supervisor, Architect, Developer, Auditor agents.
    Handles message truncation, Logfire tracing, and token cost logging.
    """
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model = MODELS.get(agent_name, MODELS["developer"])
    
    # Build message list with truncation enforced
    history = messages_history or []
    truncated = truncate_messages(history)
    messages = truncated + [{"role": "user", "content": user_message}]
    
    start = time.time()
    with logfire.span(f"claude_call_{agent_name}", model=model, agent=agent_name):
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
    
    elapsed = time.time() - start
    prompt_tokens = response.usage.input_tokens
    completion_tokens = response.usage.output_tokens
    estimated_cost = round((prompt_tokens * 0.000003) + (completion_tokens * 0.000015), 5)
    
    logfire.info("llm_usage",
        agent=agent_name,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        estimated_cost_usd=estimated_cost,
        latency_seconds=round(elapsed, 2),
    )
    
    return response.content[0].text


def call_groq(
    agent_name: str,
    system_prompt: str,
    user_message: str,
    messages_history: list[dict] = None,
    max_tokens: int = 2048,
) -> str:
    """
    Call Groq (Llama 3 70B) for Researcher and Persona agents.
    Includes exponential backoff retry + GPT-4o-mini fallback on rate limit.
    PDF spec: "if 429, wait 2s and retry. Use GPT-4o-mini as fallback."
    """
    history = truncate_messages(messages_history or [])
    messages = [{"role": "system", "content": system_prompt}] + history + \
               [{"role": "user", "content": user_message}]
    
    # Try Groq first
    for attempt, wait in enumerate([0, 2, 4]):
        try:
            if wait > 0:
                time.sleep(wait)
            
            client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
            with logfire.span(f"groq_call_{agent_name}", model=MODELS["researcher"]):
                response = client.chat.completions.create(
                    model=MODELS["researcher"],
                    messages=messages,
                    max_tokens=max_tokens,
                )
            logfire.info("groq_usage", agent=agent_name, attempt=attempt)
            return response.choices[0].message.content
            
        except Exception as e:
            if "429" in str(e) or "rate_limit" in str(e).lower():
                if attempt < 2:
                    logfire.warn("groq_rate_limit", agent=agent_name, attempt=attempt, wait=wait*2)
                    continue
                # Final fallback: GPT-4o-mini
                logfire.warn("groq_fallback_to_openai", agent=agent_name)
                return _call_openai_fallback(agent_name, system_prompt, user_message, messages_history)
            raise e
    
    return _call_openai_fallback(agent_name, system_prompt, user_message, messages_history)


def _call_openai_fallback(agent_name, system_prompt, user_message, messages_history) -> str:
    """GPT-4o-mini fallback when Groq rate-limits. PDF: 'Use GPT-4o-mini as fallback'."""
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    history = truncate_messages(messages_history or [])
    messages = [{"role": "system", "content": system_prompt}] + history + \
               [{"role": "user", "content": user_message}]
    
    with logfire.span(f"openai_fallback_{agent_name}", model=MODELS["fallback"]):
        response = client.chat.completions.create(
            model=MODELS["fallback"],
            messages=messages,
            max_tokens=2048,
        )
    return response.choices[0].message.content


def parse_json_response(raw: str) -> dict | list:
    """
    Safely parse LLM JSON output. Handles markdown fences that LLMs sometimes add.
    PDF: "strip ```json fences before parsing"
    """
    import json, re
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip().rstrip("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logfire.error("json_parse_failed", raw_preview=raw[:200], error=str(e))
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw preview: {raw[:200]}")
```

---

### PROMPT G2.2 — Update All Agents to Use Shared LLM Client
```
Update ALL agent files to import and use call_claude() / call_groq() from utils/llm_client.py.
Remove any direct anthropic/groq/openai client instantiation from agent files.

In backend/agents/supervisor.py:
- Replace: client = anthropic.Anthropic(...)
- With: from utils.llm_client import call_claude, parse_json_response
- Change all LLM calls to: response = call_claude("supervisor", system_prompt, user_message, state["messages"])

In backend/agents/researcher.py:
- Replace: client = groq.Groq(...)
- With: from utils.llm_client import call_groq, parse_json_response
- Change all LLM calls to: response = call_groq("researcher", system_prompt, user_message)

In backend/agents/persona.py:
- Same as researcher — use call_groq("persona", ...)

In backend/agents/architect.py:
- Use call_claude("architect", ...)
- The Architect is the most token-heavy agent — set max_tokens=8192

In backend/agents/developer.py:
- Use call_claude("developer", ...)
- Always pass state["messages"] as messages_history for retry context
- max_tokens=8192 (code generation needs room)

In backend/agents/auditor.py:
- Use call_claude("auditor", ...)  — uses Haiku model automatically
- max_tokens=2048 (scan output is short)

CRITICAL: Every agent must update state["messages"] after each LLM call:
# After call_claude() returns, append to messages:
state["messages"] = (state["messages"] + [
    {"role": "user", "content": user_message},
    {"role": "assistant", "content": response}
])[-12:]  # Keep last 12 entries max (6 turns)
# The truncate_messages() in llm_client.py handles this, but the slice here
# prevents unbounded growth in AgentState before the next LLM call
```

---

## GAP 3 — PYDANTIC REQUEST/RESPONSE MODELS

### PROMPT G3.1 — API Models
```
Create backend/models.py for Orin AI. All FastAPI endpoints must use typed Pydantic models.

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

# ── Request Models ──────────────────────────────────────────────

class RunRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Natural language goal for Orin AI to build",
        examples=["Build a FastAPI REST API for a task manager with JWT auth and PostgreSQL"]
    )

# ── Response Models ──────────────────────────────────────────────

class RunResponse(BaseModel):
    run_id: str
    status: str = "RUNNING"
    message: str = "Pipeline started. Connect to /stream/{run_id} for live events."

class StatusResponse(BaseModel):
    run_id: str
    status: Literal["RUNNING", "FAILED", "PANIC", "FINALIZED", "UNKNOWN"]
    iteration_count: int = 0
    agents_completed: list[str] = []
    elapsed_seconds: Optional[float] = None

class ArtifactsResponse(BaseModel):
    run_id: str
    files: dict[str, str]    # {filename: code_content}
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

# ── SSE Event Models ──────────────────────────────────────────────

class AgentEvent(BaseModel):
    """Every SSE event pushed over /stream/{run_id} follows this schema exactly.
    Matches the API contract in PDF Section 09."""
    event_type: Literal["agent_start", "agent_complete", "test_result", "status_update"]
    agent: Literal["Supervisor", "Researcher", "Persona", "Architect", "Developer", "Critic", "Auditor"]
    task_id: str = ""
    iteration: int = 0
    payload: dict = {}
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() + "Z"}

# ── Helper to build SSE events ──────────────────────────────────

def make_event(
    event_type: str,
    agent: str,
    payload: dict,
    task_id: str = "",
    iteration: int = 0,
) -> dict:
    """Build a properly structured SSE event dict ready to json.dumps()."""
    return AgentEvent(
        event_type=event_type,
        agent=agent,
        task_id=task_id,
        iteration=iteration,
        payload=payload,
    ).model_dump()

# Update backend/main.py to import and use these models:
# - POST /run: accepts RunRequest, returns RunResponse
# - GET /status/{run_id}: returns StatusResponse
# - GET /artifacts/{run_id}: returns ArtifactsResponse
# - GET /trace/{run_id}: returns TraceResponse
# - GET /health: returns HealthResponse
# - All SSE events use make_event() helper
```

**Implemented:** `backend/models.py` (Pydantic v2) defines `RunRequest`, `RunResponse`, `StatusResponse`, `ArtifactsResponse`, `TraceResponse`, `HealthResponse`, `AgentEvent`, and `make_event()`. `main.py` uses `response_model` on routes and imports `make_event` from `models`. `AgentEvent` includes optional `status` for SSE terminal detection; health uses `e2b_connected` / `tavily_connected` / `redis_connected` per model. `RunRequest.prompt` has `min_length=10`, `max_length=2000`.

---

## GAP 4 — JOIN NODE (PARALLEL MERGE LOGIC)

### PROMPT G4.1 — Phase 1 Join Node & Correction Directive
```
Update backend/graph.py with a properly implemented join_node and Supervisor
correction directive injection.

The join_node is critical — it's what merges Researcher + Persona parallel outputs
before Architect runs. Without proper merge logic, Architect may get incomplete data.

Implement:

def join_node(state: AgentState) -> AgentState:
    """
    Phase 1 join: waits for Researcher AND Persona to complete.
    Validates both outputs exist before routing to Architect.
    If either is missing, injects a warning into error_log but continues.
    LangGraph's fan-in automatically waits for both Send() branches.
    """
    issues = []
    
    if not state.get("research_output"):
        issues.append("WARNING: research_output missing — Architect proceeding without market data")
        # Set default so Architect doesn't crash
        state["research_output"] = json.dumps({
            "competitors": [],
            "pricing": [],
            "gaps": ["Market research unavailable — proceeding with general knowledge"],
            "market_size": "Unknown"
        })
    
    if not state.get("personas"):
        issues.append("WARNING: personas missing — Architect proceeding without user personas")
        state["personas"] = json.dumps([
            {"name": "Default User", "role": "Developer", "company_size": "Startup",
             "pain_points": ["Too much manual work"], "job_to_be_done": "Build software faster",
             "success_metric": "Working app in under 10 minutes"}
        ])
    
    if issues:
        state["error_log"].extend(issues)
        logfire.warn("join_node_incomplete", issues=issues)
    
    logfire.info("join_node_complete",
        has_research=bool(state.get("research_output")),
        has_personas=bool(state.get("personas"))
    )
    return state


Also implement the Correction Directive injection into the developer_node.
The PDF says: "when Critic fails a task, Supervisor generates a Correction Directive
injected into the next agent prompt."

In backend/agents/developer.py, update developer_node to call Supervisor when in panic mode:

def developer_node(state: AgentState) -> AgentState:
    # If in panic mode, get Correction Directive from Supervisor first
    correction_directive = ""
    if state["mode"] == "panic" and state["error_log"]:
        from agents.supervisor import generate_correction_directive
        correction_directive = generate_correction_directive(state)
        logfire.info("correction_directive_generated",
            directive_preview=correction_directive[:100],
            iteration=state["iteration_count"]
        )
    
    # Load correct prompt based on mode
    prompt_file = "developer_panic.txt" if state["mode"] == "panic" else "developer.txt"
    prompt_path = Path(__file__).parent.parent / "prompts" / prompt_file
    system_prompt = prompt_path.read_text()
    
    # Build context — inject correction directive if available
    context = build_agent_context(state)
    if correction_directive:
        context = f"=== SUPERVISOR CORRECTION DIRECTIVE ===\n{correction_directive}\n\n{context}"
    
    # ... rest of developer_node implementation
```

---

## GAP 5 — README AGENT (DAY 2 TASK FROM PDF)

### PROMPT G5.1 — README Generator Agent
```
Create backend/agents/readme_generator.py for Orin AI.

The PDF Section 12 lists this as a Day 2 task: "A final agent that auto-generates README.md.
Low effort, high perceived completeness during demo."

This agent runs AFTER the Auditor as the final pipeline step before FINALIZED.

from utils.llm_client import call_claude
import logfire

README_SYSTEM_PROMPT = """
You are a technical writer. Generate a professional README.md for the software project
that was just built. The README must be immediately usable — no placeholders.

Include:
1. Project name and one-line description
2. What it does (3-5 bullet points)
3. Tech stack used (from the architecture spec)
4. Installation instructions (from requirements.txt)
5. API endpoints (from the OpenAPI spec)
6. How to run tests
7. Environment variables needed
8. A "Built with Orin AI" badge at the bottom

Format: Valid Markdown. Include code blocks for commands. No placeholders like <YOUR_VALUE>.
"""

def generate_readme(state: AgentState) -> str:
    """Generates a README.md for the built project."""
    
    # Build context from state
    arch = state.get("architecture")
    code_files = state.get("code_files", {})
    
    user_message = f"""
Goal: {state["goal"]}

Architecture:
- Tech rationale: {arch.tech_rationale if arch else "Not available"}
- API spec: {arch.api_spec[:2000] if arch else "Not available"}
- DB schema: {arch.db_schema[:1000] if arch else "Not available"}

Generated files: {list(code_files.keys())}

Requirements.txt content:
{code_files.get("requirements.txt", "Not available")}

Test results: {"All tests passed" if state["test_results"] and state["test_results"][-1].passed else "Tests completed"}
Audit: {"Clean — no security violations" if state["audit_passed"] else "Completed"}

Generate a complete, professional README.md for this project.
"""
    
    return call_claude("auditor", README_SYSTEM_PROMPT, user_message, max_tokens=2048)


def readme_node(state: AgentState) -> AgentState:
    """LangGraph node — generates README and adds to code_files."""
    with logfire.span("readme_generator"):
        readme_content = generate_readme(state)
        state["code_files"]["README.md"] = readme_content
        logfire.info("readme_generated", length=len(readme_content))
    return state


Add readme_node to graph.py:
- Insert between auditor and end_success
- builder.add_node("readme_generator", readme_node)
- Update auditor's clean path: "auditor" → "readme_generator" → "end_success"
```

---

## GAP 6 — FULL FRONTEND PROMPTS

### PROMPT G6.1 — Next.js Setup & Config
```
Set up the Next.js 14 frontend for Orin AI. Follow the PDF Section 08 exactly.

Step 1: Initialize
cd frontend
npx create-next-app@latest . --typescript --tailwind --app --no-git

Step 2: Create frontend/next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/:path*",  // Proxy to FastAPI
      },
    ]
  },
}

export default nextConfig

Step 3: Create frontend/app/globals.css
Override Tailwind defaults for dark terminal aesthetic:
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --terminal-bg: #0a0a0a;
  --terminal-border: #1f1f1f;
  --terminal-green: #22c55e;
  --terminal-yellow: #eab308;
  --terminal-red: #ef4444;
  --terminal-blue: #3b82f6;
  --terminal-gray: #6b7280;
  --terminal-text: #d4d4d4;
}

body {
  background: var(--terminal-bg);
  color: var(--terminal-text);
  font-family: "JetBrains Mono", "Fira Code", monospace;
}

Step 4: Update frontend/package.json to add:
"@types/node": "^20",
"@types/react": "^18",
"@types/react-dom": "^18"

Step 5: Create frontend/app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Orin AI — Autonomous Product Lifecycle Engine",
  description: "One prompt. No human in the loop. Working, tested, audited code.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-[#d4d4d4] min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

---

### PROMPT G6.2 — SSE Stream Hook
```
Create frontend/hooks/usePipelineStream.ts

Implement EXACTLY the hook pattern from PDF Section 08:

"use client"
import { useState, useEffect, useCallback } from "react"

export interface AgentEvent {
  event_type: "agent_start" | "agent_complete" | "test_result" | "status_update"
  agent: string
  task_id: string
  iteration: number
  payload: Record<string, unknown>
  timestamp: string
}

export interface AgentStatus {
  name: string
  status: "PENDING" | "RUNNING" | "PASSED" | "FAILED"
  iteration: number
  lastOutput?: string
}

export function usePipelineStream(runId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [status, setStatus] = useState<string>("IDLE")
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({})
  const [testResults, setTestResults] = useState<AgentEvent[]>([])
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return

    const es = new EventSource(`/api/stream/${runId}`)

    es.onmessage = (e) => {
      try {
        const data: AgentEvent = JSON.parse(e.data)
        
        setEvents(prev => [...prev, data])
        
        // Update agent status cards
        if (data.event_type === "agent_start") {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: { name: data.agent, status: "RUNNING", iteration: data.iteration }
          }))
        }
        
        if (data.event_type === "agent_complete") {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: {
              ...prev[data.agent],
              status: "PASSED",
              lastOutput: String(data.payload?.output_summary || "")
            }
          }))
        }
        
        if (data.event_type === "test_result") {
          setTestResults(prev => [...prev, data])
          const passed = data.payload?.passed as boolean
          setAgentStatuses(prev => ({
            ...prev,
            Developer: {
              ...prev.Developer,
              status: passed ? "PASSED" : "FAILED",
              iteration: data.iteration
            }
          }))
        }
        
        if (data.event_type === "status_update") {
          const newStatus = data.payload?.status as string
          setStatus(newStatus)
          
          // Fetch artifacts when finalized
          if (newStatus === "FINALIZED") {
            fetch(`/api/artifacts/${runId}`)
              .then(r => r.json())
              .then(d => setCodeFiles(d.files || {}))
              .catch(console.error)
          }
          
          if (["FINALIZED", "FAILED"].includes(newStatus)) {
            es.close()
          }
        }
      } catch (err) {
        console.error("SSE parse error:", err)
      }
    }

    es.onerror = () => {
      setError("Connection lost. Retrying...")
      // EventSource auto-retries — don't manually close
    }

    return () => es.close()
  }, [runId])

  const reset = useCallback(() => {
    setEvents([])
    setStatus("IDLE")
    setAgentStatuses({})
    setTestResults([])
    setCodeFiles({})
    setError(null)
  }, [])

  return { events, status, agentStatuses, testResults, codeFiles, error, reset }
}
```

---

### PROMPT G6.3 — Main Page (Prompt Input)
```
Create frontend/app/page.tsx — the landing page with the prompt input.

"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

const EXAMPLE_PROMPTS = [
  "Build a FastAPI REST API for a task manager with JWT auth, PostgreSQL, and pytest tests",
  "Build a Python service using fastchroma for vector search with semantic similarity",
  "Build a real-time chat API with WebSockets, user rooms, and message history",
]

export default function HomePage() {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const startPipeline = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      setError("Prompt must be at least 10 characters")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to start pipeline")
      }
      
      const { run_id } = await res.json()
      router.push(`/run/${run_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 max-w-3xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Orin AI</h1>
        <p className="text-[var(--terminal-gray)] text-lg">
          One prompt. No human in the loop. Working, tested, audited code.
        </p>
      </div>

      <div className="w-full space-y-4">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe what you want to build..."
          rows={4}
          className="w-full bg-[#111] border border-[var(--terminal-border)] rounded-lg p-4 
                     text-[var(--terminal-text)] font-mono text-sm resize-none
                     focus:outline-none focus:border-[var(--terminal-green)]
                     placeholder:text-[var(--terminal-gray)]"
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startPipeline()
          }}
        />
        
        {error && (
          <p className="text-[var(--terminal-red)] text-sm font-mono">⚠ {error}</p>
        )}
        
        <button
          onClick={startPipeline}
          disabled={loading || !prompt.trim()}
          className="w-full py-3 bg-[var(--terminal-green)] text-black font-bold 
                     rounded-lg hover:opacity-90 disabled:opacity-40 
                     disabled:cursor-not-allowed transition-opacity font-mono"
        >
          {loading ? "Starting Orin AI..." : "▶ Run Orin AI"}
        </button>
        
        <p className="text-[var(--terminal-gray)] text-xs text-center font-mono">
          ⌘ + Enter to run
        </p>
      </div>

      <div className="mt-10 w-full">
        <p className="text-[var(--terminal-gray)] text-xs font-mono mb-3">— example prompts —</p>
        <div className="space-y-2">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => setPrompt(p)}
              className="w-full text-left text-xs font-mono text-[var(--terminal-gray)] 
                         hover:text-[var(--terminal-text)] p-2 rounded border 
                         border-transparent hover:border-[var(--terminal-border)] transition-all"
            >
              › {p}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
```

---

### PROMPT G6.4 — Live Dashboard Page
```
Create frontend/app/run/[id]/page.tsx — the 3-panel live dashboard.

"use client"
import { use } from "react"
import { usePipelineStream } from "@/hooks/usePipelineStream"
import AgentFeed from "@/components/AgentFeed"
import TerminalPanel from "@/components/TerminalPanel"
import ArtifactPanel from "@/components/ArtifactPanel"
import Link from "next/link"

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = use(params)
  const { events, status, agentStatuses, testResults, codeFiles, error } =
    usePipelineStream(runId)

  const statusColor = {
    RUNNING: "text-[var(--terminal-yellow)]",
    FINALIZED: "text-[var(--terminal-green)]",
    FAILED: "text-[var(--terminal-red)]",
    PANIC: "text-orange-400",
    IDLE: "text-[var(--terminal-gray)]",
  }[status] || "text-[var(--terminal-gray)]"

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2 
                          border-b border-[var(--terminal-border)] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[var(--terminal-gray)] hover:text-white 
                                     font-mono text-sm transition-colors">
            ← Orin AI
          </Link>
          <span className="text-[var(--terminal-border)]">|</span>
          <span className="font-mono text-xs text-[var(--terminal-gray)] truncate max-w-xs">
            run/{runId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[var(--terminal-red)] text-xs font-mono">{error}</span>
          )}
          <span className={`font-mono text-sm font-bold ${statusColor}`}>
            ● {status}
          </span>
        </div>
      </header>

      {/* 3-panel grid — matches PDF Section 08 layout exactly */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {/* Left: Agent Feed */}
        <div className="border-r border-[var(--terminal-border)] overflow-y-auto">
          <AgentFeed agentStatuses={agentStatuses} events={events} />
        </div>
        
        {/* Center: Terminal Output */}
        <div className="border-r border-[var(--terminal-border)] overflow-hidden flex flex-col">
          <TerminalPanel testResults={testResults} events={events} />
        </div>
        
        {/* Right: Artifacts */}
        <div className="overflow-hidden flex flex-col">
          <ArtifactPanel codeFiles={codeFiles} runId={runId} status={status} />
        </div>
      </div>
    </div>
  )
}
```

---

### PROMPT G6.5 — AgentFeed Component
```
Create frontend/components/AgentFeed.tsx

import { AgentEvent, AgentStatus } from "@/hooks/usePipelineStream"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-[var(--terminal-gray)]",
  RUNNING: "text-[var(--terminal-yellow)]",
  PASSED:  "text-[var(--terminal-green)]",
  FAILED:  "text-[var(--terminal-red)]",
}

const STATUS_ICONS: Record<string, string> = {
  PENDING: "○",
  RUNNING: "◌",
  PASSED:  "✓",
  FAILED:  "✗",
}

const AGENT_ORDER = ["Supervisor", "Researcher", "Persona", "Architect", "Developer", "Critic", "Auditor"]

interface Props {
  agentStatuses: Record<string, AgentStatus>
  events: AgentEvent[]
}

function AgentCard({ agent, status }: { agent: string; status?: AgentStatus }) {
  const s = status?.status || "PENDING"
  const color = STATUS_COLORS[s]
  const icon  = STATUS_ICONS[s]
  
  return (
    <div className={`border border-[var(--terminal-border)] rounded p-3 mb-2 
                     bg-[#111] transition-all ${s === "RUNNING" ? "border-yellow-500/30" : ""}
                     ${s === "PASSED" ? "border-green-500/20" : ""}
                     ${s === "FAILED" ? "border-red-500/30" : ""}`}>
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm text-[var(--terminal-text)]">{agent}</span>
        <span className={`text-xs font-bold font-mono ${color}`}>
          {icon} {s}
        </span>
      </div>
      {status && status.iteration > 0 && (
        <div className="text-xs text-[var(--terminal-gray)] font-mono mt-1">
          retry #{status.iteration}
        </div>
      )}
      {status?.lastOutput && (
        <div className="text-xs text-[var(--terminal-gray)] font-mono mt-1 truncate">
          {status.lastOutput}
        </div>
      )}
    </div>
  )
}

export default function AgentFeed({ agentStatuses, events }: Props) {
  const recentEvents = events.slice(-20)
  
  return (
    <div className="p-3 h-full flex flex-col">
      <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase 
                     tracking-widest mb-3 shrink-0">
        Agent Status
      </h2>
      
      <div className="flex-1 overflow-y-auto">
        {AGENT_ORDER.map(agent => (
          <AgentCard
            key={agent}
            agent={agent}
            status={agentStatuses[agent]}
          />
        ))}
        
        <div className="mt-4 border-t border-[var(--terminal-border)] pt-3">
          <h3 className="font-mono text-xs text-[var(--terminal-gray)] uppercase 
                         tracking-widest mb-2">
            Event Log
          </h3>
          <div className="space-y-1">
            {recentEvents.map((event, i) => (
              <div key={i} className="font-mono text-xs text-[var(--terminal-gray)]">
                <span className="text-[var(--terminal-blue)]">[{event.agent}]</span>{" "}
                {event.event_type}
                {event.iteration > 0 && (
                  <span className="text-orange-400"> iter:{event.iteration}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

### PROMPT G6.6 — TerminalPanel Component
```
Create frontend/components/TerminalPanel.tsx

"use client"
import { useEffect, useRef } from "react"
import { AgentEvent } from "@/hooks/usePipelineStream"

interface Props {
  testResults: AgentEvent[]
  events: AgentEvent[]
}

export default function TerminalPanel({ testResults, events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new events — simulates live terminal
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events, testResults])

  const allLines = events.map((e, i) => {
    const time = new Date(e.timestamp).toLocaleTimeString("en-US", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
    })
    
    if (e.event_type === "agent_start") {
      return (
        <div key={i} className="text-[var(--terminal-yellow)]">
          [{time}] ▶ {e.agent} starting task {e.task_id}
        </div>
      )
    }
    
    if (e.event_type === "agent_complete") {
      const summary = String(e.payload?.output_summary || "")
      return (
        <div key={i} className="text-[var(--terminal-green)]">
          [{time}] ✓ {e.agent} complete: {summary.slice(0, 80)}
        </div>
      )
    }
    
    if (e.event_type === "test_result") {
      const passed = e.payload?.passed as boolean
      const stdout = String(e.payload?.stdout || "")
      const stderr = String(e.payload?.stderr || "")
      
      return (
        <div key={i} className="my-2">
          <div className={passed ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}>
            [{time}] {passed ? "✓ TESTS PASSED" : "✗ TESTS FAILED"} (iter {e.iteration})
          </div>
          {stdout && (
            <pre className="text-[var(--terminal-gray)] text-xs mt-1 ml-4 whitespace-pre-wrap">
              {stdout.slice(0, 500)}
            </pre>
          )}
          {!passed && stderr && (
            <pre className="text-[var(--terminal-red)] text-xs mt-1 ml-4 whitespace-pre-wrap opacity-80">
              {stderr.slice(0, 300)}
            </pre>
          )}
        </div>
      )
    }
    
    if (e.event_type === "status_update") {
      const status = e.payload?.status as string
      const color = status === "FINALIZED" ? "text-[var(--terminal-green)]" :
                    status === "FAILED"    ? "text-[var(--terminal-red)]"   :
                    status === "PANIC"     ? "text-orange-400" :
                    "text-[var(--terminal-gray)]"
      return (
        <div key={i} className={`font-bold ${color}`}>
          [{time}] ═══ PIPELINE STATUS: {status} ═══
        </div>
      )
    }
    
    return null
  })

  return (
    <div className="p-3 h-full flex flex-col">
      <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase 
                     tracking-widest mb-3 shrink-0">
        Terminal Output
      </h2>
      
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
        <div className="text-[var(--terminal-gray)] mb-2">
          Orin AI v1.0 — autonomous pipeline initialized
        </div>
        {allLines}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
```

---

### PROMPT G6.7 — ArtifactPanel Component
```
Create frontend/components/ArtifactPanel.tsx

"use client"
import { useState } from "react"

interface Props {
  codeFiles: Record<string, string>
  runId: string
  status: string
}

export default function ArtifactPanel({ codeFiles, runId, status }: Props) {
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const fileNames = Object.keys(codeFiles)
  const displayFile = activeFile || fileNames[0] || null

  const downloadAll = () => {
    // Create a JSON blob of all files for download
    const blob = new Blob([JSON.stringify(codeFiles, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `swarm-os-${runId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getFileColor = (filename: string) => {
    if (filename.endsWith(".py"))    return "text-[var(--terminal-blue)]"
    if (filename.endsWith(".txt"))   return "text-[var(--terminal-yellow)]"
    if (filename.endsWith(".yml") || filename.endsWith(".yaml")) return "text-orange-400"
    if (filename.endsWith(".md"))    return "text-purple-400"
    return "text-[var(--terminal-text)]"
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest">
          Artifacts ({fileNames.length})
        </h2>
        {status === "FINALIZED" && fileNames.length > 0 && (
          <button
            onClick={downloadAll}
            className="font-mono text-xs text-[var(--terminal-green)] 
                       hover:underline cursor-pointer"
          >
            ↓ download all
          </button>
        )}
      </div>

      {fileNames.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-[var(--terminal-gray)] text-center">
            {status === "RUNNING" ? "Waiting for Developer agent..." : "No files generated"}
          </p>
        </div>
      ) : (
        <>
          {/* File tabs */}
          <div className="flex flex-wrap gap-1 mb-2 shrink-0">
            {fileNames.map(name => (
              <button
                key={name}
                onClick={() => setActiveFile(name)}
                className={`font-mono text-xs px-2 py-1 rounded border transition-colors
                  ${(displayFile === name)
                    ? "border-[var(--terminal-green)] text-[var(--terminal-green)] bg-green-500/5"
                    : "border-[var(--terminal-border)] text-[var(--terminal-gray)] hover:border-[var(--terminal-gray)]"
                  } ${getFileColor(name)}`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* File content */}
          {displayFile && (
            <div className="flex-1 overflow-hidden flex flex-col 
                            border border-[var(--terminal-border)] rounded">
              <div className="px-3 py-1 border-b border-[var(--terminal-border)] 
                              bg-[#111] shrink-0">
                <span className={`font-mono text-xs ${getFileColor(displayFile)}`}>
                  {displayFile}
                </span>
                <span className="font-mono text-xs text-[var(--terminal-gray)] ml-2">
                  {codeFiles[displayFile]?.split("\n").length} lines
                </span>
              </div>
              <pre className="flex-1 overflow-auto p-3 font-mono text-xs 
                              text-[var(--terminal-text)] leading-relaxed whitespace-pre">
                {codeFiles[displayFile]}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

---

## COMPLETE BUILD CHECKLIST (V1 + ADDENDUM)

```
TEAM AGREEMENT (before ANY code):
[ ] PROMPT 0.1  — Scaffold
[ ] PROMPT 0.2  — Prompt files
[ ] PROMPT 1.1  — AgentState  ← FREEZE THIS. No changes without team vote.
[x] PROMPT G3.1 — API models  ← Define the contract everyone codes to

DAY 1 — CORE ENGINE (priority order from PDF):
[ ] PROMPT G1.1 — docker-compose + Dockerfiles
[ ] PROMPT G2.1 — Shared LLM client (call_claude, call_groq, parse_json)  ← BEFORE any agent
[ ] PROMPT 2.1  — E2B tools
[ ] PROMPT 2.2  — Tavily tools
[ ] PROMPT 3.5  — Developer agent  ← USE call_claude from G2.1
[ ] PROMPT 3.6  — Critic node + routing
[ ] PROMPT G2.2 — Wire all agents to shared LLM client
[ ] PROMPT G4.1 — Join node + Correction Directive injection
[ ] PROMPT 4.1  — Graph assembly (full wiring)
[ ] PROMPT 5.1  — FastAPI server
[ ] PROMPT G1.2 — Redis state persistence

DAY 1 AFTERNOON:
[ ] PROMPT 3.1  — Supervisor agent
[ ] PROMPT 3.2  — Researcher agent
[ ] PROMPT 3.3  — Persona agent
[ ] PROMPT 3.4  — Architect agent
[ ] PROMPT 3.7  — Auditor agent
[ ] PROMPT G5.1 — README generator agent
[ ] PROMPT 6.1  — Logfire hardening
[ ] PROMPT 8.2  — Startup validation

DAY 1 NIGHT — INTEGRATION:
[ ] PROMPT 7.1  — Integration tests
[ ] PROMPT 7.2  — Adversarial self-healing test (MUST PASS 3 TIMES)
[ ] Full run: "Build a FastAPI todo app with JWT auth and pytest tests"

DAY 2 MORNING — FRONTEND:
[ ] PROMPT G6.1 — Next.js setup + next.config.ts
[ ] PROMPT G6.2 — usePipelineStream hook
[ ] PROMPT G6.3 — Main page (prompt input)
[ ] PROMPT G6.4 — Live dashboard page (/run/[id])
[ ] PROMPT G6.5 — AgentFeed component
[ ] PROMPT G6.6 — TerminalPanel component
[ ] PROMPT G6.7 — ArtifactPanel component

DAY 2 AFTERNOON — HARDENING + DEMO:
[ ] PROMPT 8.1  — Error handling + graceful degradation
[ ] PROMPT 9.1  — Demo warm-up script (run it NOW)
[ ] PROMPT 9.2  — README.md
[ ] Demo rehearsal x3 (4-minute script from PDF Section 13)
[ ] Screen record backup video
[ ] Bookmark Logfire dashboard URL

WHAT PERSON DOES WHAT:
Person 1 → graph.py + state.py + G4.1 (owns LangGraph exclusively)
Person 2 → Developer + Critic + E2B (the demo's core mechanism)
Person 3 → Supervisor + Researcher + Persona + Architect + G2.1
Person 4 → FastAPI + Frontend (G6.1 through G6.7)
Interface between everyone = AgentState + AgentEvent models from G3.1
```
