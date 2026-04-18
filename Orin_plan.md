# Orin AI — Production Build Prompt Sequence
> PM + Senior Backend Architect + Senior AI Engineer perspective
> 100% sourced from Orin AI Project Brief v1.0
> Execute prompts IN ORDER. Each prompt builds on the previous.

---

## PHASE 0 — PROJECT SCAFFOLD & ENVIRONMENT

### PROMPT 0.1 — Project Structure
```
Create the exact Orin AI folder structure as specified below. Generate every file as an empty stub with correct imports and a TODO comment. Do not write any logic yet.

Folder structure:
orin-ai/
├── backend/
│   ├── main.py
│   ├── state.py
│   ├── graph.py
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── supervisor.py
│   │   ├── researcher.py
│   │   ├── persona.py
│   │   ├── architect.py
│   │   ├── developer.py
│   │   ├── critic.py
│   │   └── auditor.py
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── e2b_tools.py
│   │   └── tavily_tools.py
│   ├── prompts/
│   │   ├── supervisor.txt
│   │   ├── developer.txt
│   │   └── developer_panic.txt
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   └── run/[id]/page.tsx
│   ├── components/
│   │   ├── AgentFeed.tsx
│   │   ├── TerminalPanel.tsx
│   │   └── ArtifactPanel.tsx
│   └── hooks/
│       └── usePipelineStream.ts
├── .env.example
├── docker-compose.yml
└── README.md

For requirements.txt include:
fastapi
uvicorn[standard]
langgraph
anthropic
openai
groq
tavily-python
e2b-code-interpreter
logfire[fastapi]
sse-starlette
pydantic
python-dotenv
httpx

For .env.example include all keys from the project:
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
E2B_API_KEY=e2b_...
LOGFIRE_TOKEN=...
```

---

### PROMPT 0.2 — Prompt Files
```
Create the three prompt text files for Orin AI agents based on these exact specifications:

FILE: backend/prompts/supervisor.txt
You are the Head of Digital Workforce (HDW) for Orin AI. Your objective is to decompose the user's goal into a TaskGraph.

Each task in the TaskGraph must have:
- task_id (string, format: "task_001")
- assigned_agent (one of: Researcher, Persona, Architect, Developer, Critic, Auditor)
- dependencies (list of task_ids that must complete first — empty list if no dependencies)
- success_criteria (specific, measurable definition of done)

Rules:
- Researcher and Persona tasks must always have no dependencies (they run in parallel in Phase 1)
- Architect must depend on both Researcher and Persona tasks
- Developer must depend on Architect
- Critic must depend on Developer
- Auditor must depend on Critic passing
- Never accept worker output without Critic validation
- If iteration_count > 3, switch to Panic Mode: analyze the error log and generate a Correction Directive

Return ONLY a valid JSON array of Task objects. No explanation, no markdown.

---

FILE: backend/prompts/developer.txt
You are a senior software developer at Orin AI.

Your job: implement the architecture specification provided. Write production-quality Python code.

Requirements:
- Write the main application file (app.py)
- Write requirements.txt with all dependencies
- Write a pytest test suite (test_app.py) with at least 3 meaningful tests
- Include proper error handling, type hints, and docstrings
- Code must be self-contained and runnable in a clean Python environment

If previous attempts failed, the terminal trace is included below. Your job is to:
1. Read the EXACT error message
2. Identify the single root cause
3. Fix ONLY the failing component
4. Do not rewrite working code

Return a JSON object: {"app.py": "<code>", "requirements.txt": "<deps>", "test_app.py": "<tests>"}

---

FILE: backend/prompts/developer_panic.txt
PANIC MODE ACTIVATED. You are debugging a critical failure after 3+ failed attempts.

STOP. Do NOT rewrite everything.

Your ONLY job:
1. Read the terminal trace below carefully
2. Identify the SINGLE root cause of failure
3. Output ONLY the changed file(s) that fix that root cause
4. Leave all working files unchanged

Common root causes to check:
- Wrong package name (e.g. "fastchroma" doesn't exist — should be "chromadb")
- Missing __init__.py or import path error
- Version incompatibility in requirements.txt
- pytest collection error (wrong test file naming)
- Port or environment variable not set

Return a JSON object with ONLY the files that changed: {"<filename>": "<fixed_code>"}
```

---

## PHASE 1 — AGENTSTATE (THE BACKBONE)

### PROMPT 1.1 — AgentState Schema
```
Create backend/state.py for Orin AI. This is the single source of truth for the entire pipeline.

Implement EXACTLY this schema:

from typing import TypedDict, Literal, Optional
from dataclasses import dataclass, field

@dataclass
class Task:
    task_id: str
    assigned_agent: str  # Supervisor|Researcher|Architect|Developer|Critic|Auditor
    dependencies: list[str]
    success_criteria: str
    status: str = "PENDING"  # PENDING|RUNNING|PASSED|FAILED
    iteration_count: int = 0

@dataclass
class Architecture:
    docker_compose: str
    db_schema: str        # SQLAlchemy models as string
    api_spec: str         # OpenAPI YAML as string
    tech_rationale: str

@dataclass
class TestRun:
    iteration: int
    stdout: str
    stderr: str
    exit_code: int
    passed: bool

class AgentState(TypedDict):
    # Core intent
    goal: str
    task_graph: list[Task]
    
    # Execution context
    current_task_id: str
    iteration_count: int
    mode: str  # "normal" | "panic"
    
    # Phase 1 outputs
    research_output: Optional[str]   # competitor analysis JSON
    personas: Optional[str]          # user personas JSON
    
    # Phase 2 outputs
    architecture: Optional[Architecture]
    
    # Phase 3 outputs
    code_files: dict[str, str]       # {filename: code_string}
    test_results: list[TestRun]      # all test runs including failures
    
    # Phase 4 outputs
    audit_report: Optional[dict]
    audit_passed: bool
    
    # Pipeline control
    status: Literal["RUNNING", "FAILED", "PANIC", "FINALIZED"]
    error_log: list[str]
    messages: list[dict]

Also add this helper function below the TypedDict:

def get_initial_state(goal: str) -> AgentState:
    """Returns a fresh AgentState for a new pipeline run."""
    return AgentState(
        goal=goal,
        task_graph=[],
        current_task_id="",
        iteration_count=0,
        mode="normal",
        research_output=None,
        personas=None,
        architecture=None,
        code_files={},
        test_results=[],
        audit_report=None,
        audit_passed=False,
        status="RUNNING",
        error_log=[],
        messages=[]
    )

And this critical context builder (Pattern 1 from the project brief):

def build_agent_context(state: AgentState) -> str:
    """
    CRITICAL: Always call this before any LLM invocation.
    Injects exactly the right context — no more, no less.
    Truncates to prevent context window overflow.
    """
    context_parts = [
        f"=== ORIGINAL GOAL ===\n{state['goal']}",
        f"=== CURRENT TASK ===\n{state.get('current_task_id', 'none')}",
    ]
    
    recent_failures = [t for t in state["test_results"] if not t.passed][-2:]
    if recent_failures:
        context_parts.append("=== PREVIOUS FAILURES (diagnose these) ===")
        for tf in recent_failures:
            context_parts.append(f"Iteration {tf.iteration}:\nSTDOUT: {tf.stdout[:300]}\nSTDERR: {tf.stderr[:500]}")
    
    if state.get("architecture"):
        arch = state["architecture"]
        context_parts.append(f"=== ARCHITECTURE SPEC ===\n{arch.api_spec}")
    
    return "\n\n".join(context_parts)


def get_developer_prompt_mode(state: AgentState) -> str:
    """Returns 'panic' or 'normal' based on iteration count and mode."""
    if state["iteration_count"] >= 3 or state["mode"] == "panic":
        return "panic"
    return "normal"
```

---

## PHASE 2 — TOOLS LAYER

### PROMPT 2.1 — E2B Sandbox Tool
```
Create backend/tools/e2b_tools.py for Orin AI. This wraps the E2B sandbox for the Developer agent.

Requirements:
- Import: from e2b_code_interpreter import Sandbox
- Load E2B_API_KEY from environment via python-dotenv
- Implement these functions:

1. run_code_in_sandbox(code_files: dict[str, str]) -> dict
   - Accepts {filename: code_string} dict
   - Opens an E2B Sandbox context
   - Writes ALL files to the sandbox using sb.files.write()
   - Runs: pip install -r requirements.txt -q (capture output)
   - Runs: pytest test_app.py -v --tb=short (capture output)
   - Returns: {
       "stdout": str,
       "stderr": str,
       "exit_code": int,
       "install_output": str,
       "passed": bool
     }
   - passed = True only if exit_code == 0

2. write_and_run_command(code_files: dict[str, str], command: str) -> dict
   - Same file writing logic
   - Runs a custom command instead of pytest
   - Returns same structure

3. validate_e2b_connection() -> bool
   - Opens a sandbox, runs echo "ok", returns True if stdout contains "ok"
   - Used for health checks

Error handling:
- Wrap all sandbox operations in try/except
- On timeout or connection error: return {"stdout": "", "stderr": str(e), "exit_code": 1, "passed": False}
- Log errors using print for now (Logfire added later)

Add a __main__ block that calls validate_e2b_connection() and prints the result.
```

---

### PROMPT 2.2 — Tavily Search Tool
```
Create backend/tools/tavily_tools.py for Orin AI. This wraps Tavily search for the Researcher agent.

Requirements:
- Import: from tavily import TavilyClient
- Load TAVILY_API_KEY from environment
- Implement these functions:

1. search_competitors(goal: str) -> dict
   - Extracts the product domain from the goal string
   - Runs 3 Tavily searches:
     a. f"top competitors {domain} 2024 features pricing"
     b. f"{domain} user complaints pain points reddit"
     c. f"{domain} market size funding 2024"
   - Each search: max_results=5, search_depth="advanced"
   - Aggregates results into: {
       "competitors": [{"name", "url", "description", "pricing_hint"}],
       "pain_points": [str],
       "market_context": str
     }
   - Returns the aggregated dict

2. search_technology(query: str) -> list[dict]
   - Single Tavily search for technology/library research
   - Used by Developer agent when a library fails
   - Returns list of {title, url, content} results

Error handling:
- Add exponential backoff retry: if TavilyError, wait 2s then 4s then 8s, max 3 attempts
- On final failure: return {"competitors": [], "pain_points": [], "market_context": "Search unavailable — proceeding with general knowledge"}
- This ensures the pipeline never hard-fails on a Tavily timeout

Add a __main__ block that tests search_competitors("task management app") and prints results.
```

---

## PHASE 3 — AGENT IMPLEMENTATIONS

### PROMPT 3.1 — Supervisor Agent
```
Create backend/agents/supervisor.py for Orin AI.

This is the Head of Digital Workforce (HDW) — the orchestrator brain.

Requirements:
- Model: Claude claude-sonnet-4-20250514 (Anthropic)
- Load prompt from backend/prompts/supervisor.txt
- Load ANTHROPIC_API_KEY from environment

Implement:

1. generate_task_graph(state: AgentState) -> list[Task]
   - Calls Claude with the supervisor.txt system prompt
   - User message: f"Goal: {state['goal']}\n\nGenerate the TaskGraph JSON."
   - Parses the JSON response into list[Task] dataclass instances
   - Validates that: Researcher and Persona have no dependencies, Architect depends on both, Developer depends on Architect
   - Returns list[Task]

2. generate_correction_directive(state: AgentState) -> str
   - Called when iteration_count >= 3 (panic mode trigger)
   - Sends to Claude: goal + current_task + last 3 error_log entries
   - Returns a string "Correction Directive" to inject into Developer's next prompt
   - This is the Supervisor's self-healing intelligence

3. supervisor_node(state: AgentState) -> AgentState
   - The LangGraph node function
   - Calls generate_task_graph()
   - Sets state["task_graph"] and state["current_task_id"] to first task
   - Wraps in logfire.span("supervisor_agent")
   - Returns updated state

Message truncation: Always limit messages[] to last 6 turns before any LLM call.
Use build_agent_context() from state.py for context injection.
```

---

### PROMPT 3.2 — Researcher Agent
```
Create backend/agents/researcher.py for Orin AI.

This is the market intelligence agent — runs in PARALLEL with Persona agent (Phase 1).

Requirements:
- Model: Groq / Llama 3 70B (groq client with model "llama3-70b-8192")
- Fallback: GPT-4o-mini if Groq returns 429
- Load GROQ_API_KEY and OPENAI_API_KEY from environment

Implement:

1. run_market_research(state: AgentState) -> str
   - Calls search_competitors() from tavily_tools.py with the goal
   - Takes the Tavily results and sends to Groq LLM to synthesize into structured JSON
   - System prompt: "You are a market research analyst. Given raw search data, produce a structured competitor analysis."
   - User message: f"Goal: {state['goal']}\n\nRaw search data:\n{json.dumps(tavily_results)}\n\nReturn JSON: {{competitors: [], pricing: [], gaps: [], market_size: ''}}"
   - Returns the JSON string

2. researcher_node(state: AgentState) -> AgentState
   - The LangGraph node function
   - Calls run_market_research()
   - Sets state["research_output"] to the result
   - Wraps in logfire.span("researcher_agent")
   - Returns updated state

Groq rate limit handling:
- Catch groq.RateLimitError (HTTP 429)
- Wait 2 seconds
- Retry with GPT-4o-mini via OpenAI client
- Log which model was used

Return format must be valid JSON string (no markdown fences).
```

---

### PROMPT 3.3 — Persona Agent
```
Create backend/agents/persona.py for Orin AI.

This runs in PARALLEL with Researcher agent (Phase 1 fan-out via LangGraph Send API).

Requirements:
- Model: Groq / Llama 3 70B with GPT-4o-mini fallback (same pattern as Researcher)

Implement:

1. generate_personas(state: AgentState) -> str
   - Takes state["goal"] and state["research_output"] (may be None if running truly parallel)
   - Calls Groq LLM with this system prompt:
     "Generate 3 detailed user personas for this product. For each persona: name, role, company_size, 3 pain_points[], job_to_be_done, success_metric. Ground personas in market research if available. Return JSON only — no markdown."
   - User message: f"Product goal: {state['goal']}\n\nMarket research context:\n{state.get('research_output', 'Not yet available')}"
   - Returns JSON string of 3 personas

2. persona_node(state: AgentState) -> AgentState
   - The LangGraph node function
   - Calls generate_personas()
   - Sets state["personas"]
   - Wraps in logfire.span("persona_agent")
   - Returns updated state

Important: This agent can run with research_output=None. Design the prompt to work with or without it. The join node in graph.py waits for both Researcher and Persona to complete before routing to Architect.
```

---

### PROMPT 3.4 — Architect Agent
```
Create backend/agents/architect.py for Orin AI.

This is the most prompt-sensitive agent. Test it in isolation before integration.

Requirements:
- Model: Claude claude-sonnet-4-20250514 (Anthropic) — highest quality needed here
- Input: goal + research_output + personas
- Output: Architecture dataclass

Implement:

1. generate_architecture(state: AgentState) -> Architecture
   - Calls Claude with this system prompt:
     "You are a senior software architect. Generate a complete technical architecture as JSON."
   - User message combines:
     - Original goal
     - Competitor analysis (from research_output)
     - User personas
     - Instruction: "Generate: (1) docker-compose.yml content, (2) SQLAlchemy models as Python code string, (3) OpenAPI YAML spec for all endpoints, (4) tech stack rationale. Optimize for: MVP speed, testability, security. Return JSON: {docker_compose: str, db_schema: str, api_spec: str, tech_rationale: str}"
   - Parse response JSON into Architecture dataclass
   - Validate all 4 fields are non-empty strings

2. architect_node(state: AgentState) -> AgentState
   - Calls generate_architecture()
   - Sets state["architecture"]
   - Wraps in logfire.span("architect_agent", goal=state["goal"][:50])
   - Returns updated state

Validation: If any Architecture field is empty or malformed JSON, raise ValueError with a descriptive message. The Supervisor's error_log will capture this.
```

---

### PROMPT 3.5 — Developer Agent
```
Create backend/agents/developer.py for Orin AI.

This is the most complex agent — it writes code and is the heart of the self-healing loop.

Requirements:
- Model: Claude claude-sonnet-4-20250514 (Anthropic) — primary; GPT-4o fallback
- Integrates with E2B sandbox via e2b_tools.py
- Reads developer.txt OR developer_panic.txt based on iteration_count

Implement:

1. generate_code(state: AgentState) -> dict[str, str]
   - Determines prompt mode: get_developer_prompt_mode(state) from state.py
   - Loads correct prompt file (developer.txt or developer_panic.txt)
   - Builds context using build_agent_context(state) from state.py
   - Calls Claude with system prompt + context
   - Parses response as JSON dict {filename: code_string}
   - Must return at minimum: {"app.py": ..., "requirements.txt": ..., "test_app.py": ...}

2. execute_and_test(code_files: dict[str, str], iteration: int) -> TestRun
   - Calls run_code_in_sandbox(code_files) from e2b_tools.py
   - Converts result to TestRun dataclass
   - Sets passed = (exit_code == 0)

3. developer_node(state: AgentState) -> AgentState
   - Calls generate_code() to get code files
   - Calls execute_and_test() to run in E2B
   - Appends TestRun to state["test_results"]
   - Updates state["code_files"] with new code
   - Increments state["iteration_count"]
   - If iteration_count >= 3: sets state["mode"] = "panic"
   - Wraps entire function in logfire.span("developer_agent", iteration=state["iteration_count"], mode=state["mode"])
   - Returns updated state

CRITICAL context injection — always include in LLM call:
- Original goal
- Current architecture spec  
- Last 2 failed terminal outputs (stderr truncated to 500 chars each)
- Current iteration number
WITHOUT this context, retry logic breaks.
```

---

### PROMPT 3.6 — Critic Node
```
Create backend/agents/critic.py for Orin AI.

The Critic is intentionally simple — heuristic first, LLM optional.

Requirements:
- NO LLM call by default (pure heuristic — fast and reliable)
- Reads the last TestRun from state["test_results"]

Implement:

1. evaluate_test_result(state: AgentState) -> tuple[bool, str]
   - Gets last TestRun: state["test_results"][-1] if state["test_results"] else None
   - If no test results: return (False, "No test results found")
   - PASS conditions (exit_code == 0 AND):
     - stdout does not contain "FAILED"
     - stdout does not contain "ERROR"
     - stderr does not contain "ModuleNotFoundError"
   - FAIL: anything else
   - Returns (passed: bool, reason: str)

2. check_for_security_flags(state: AgentState) -> bool
   - If exit_code == 0 but stderr contains "warning" or stdout contains "DeprecationWarning"
   - Returns True to flag for Auditor attention
   - Does NOT fail the pipeline — just sets a flag

3. critic_node(state: AgentState) -> AgentState
   - Calls evaluate_test_result()
   - If PASS: marks current task as PASSED in task_graph, returns state unchanged
   - If FAIL: appends failure reason to state["error_log"], returns state (LangGraph routing handles retry)
   - Wraps in logfire.span("critic_node", passed=passed, iteration=state["iteration_count"])
   - Returns updated state

4. route_after_critic(state: AgentState) -> str
   CRITICAL routing function — this IS the self-healing loop:
   - If state["iteration_count"] > 5: return "end_failed"
   - If state["iteration_count"] >= 3: return "developer"  (panic mode)
   - last_test = state["test_results"][-1]
   - If last_test.passed: return "auditor"
   - Else: return "developer"  (retry)
```

---

### PROMPT 3.7 — Auditor Agent
```
Create backend/agents/auditor.py for Orin AI.

The Auditor is the final security gate before FINALIZED status.

Requirements:
- Model: Claude Haiku (claude-haiku-4-5-20251001) — fast and cheap for scanning
- Minimum viable version: Python regex scan (no LLM needed for basic demo)
- LLM review is additive on top

Implement:

1. regex_scan(code_files: dict[str, str]) -> list[dict]
   - Scans ALL code files as strings
   - Checks for:
     a. Hardcoded secrets: re.findall(r'[A-Za-z0-9]{32,}', line) — flag if looks like API key
     b. SQL injection: string interpolation in queries — pattern: f"SELECT.*{
     c. Unsafe eval: eval( or exec( with user-controlled input
     d. Missing auth: route definitions without auth dependency
   - Returns list of {file, line_number, type, severity, snippet}

2. llm_security_review(code_files: dict[str, str], regex_violations: list) -> dict
   - Only called if regex_scan finds violations OR if time permits
   - Sends all code + regex findings to Claude Haiku
   - System prompt: "You are a security auditor. Review code for: hardcoded secrets, SQL injection, unsafe eval, missing auth. Return JSON: {clean: bool, violations: [{file, line, type, severity}]}"
   - Returns parsed JSON

3. auditor_node(state: AgentState) -> AgentState
   - Runs regex_scan on state["code_files"]
   - If violations found: runs llm_security_review() and re-routes to Developer with remediation instructions
   - If clean: sets state["audit_passed"] = True, state["status"] = "FINALIZED"
   - Sets state["audit_report"] with full scan results
   - Wraps in logfire.span("auditor_agent", violations_count=len(violations))
   - Returns updated state

Route function:
def route_after_audit(state: AgentState) -> str:
    if state["audit_passed"]:
        return "end_success"
    return "developer"  # re-route with security fix instructions
```

---

## PHASE 4 — LANGGRAPH PIPELINE (THE BRAIN)

### PROMPT 4.1 — Graph Assembly
```
Create backend/graph.py for Orin AI. This assembles the entire LangGraph directed state graph.

Import all agent node functions and routing functions from their respective modules.
Import AgentState from state.py.

Build the complete graph following these EXACT phases from the architecture:

PHASE 1 — Parallel discovery (Researcher + Persona fan-out):
- supervisor runs first
- supervisor_node returns Send() objects for BOTH researcher and persona simultaneously
- Use LangGraph's Send() API for fan-out

PHASE 2 — Blueprint (Sequential):
- join_node waits for both researcher and persona results
- join routes to architect

PHASE 3 — Production Loop (Self-Healing):
- architect → developer → critic
- route_after_critic determines next: "auditor" | "developer" | "end_failed"
- Max 5 iterations total (iteration_count > 5 = end_failed)

PHASE 4 — Security Gate:
- auditor → route_after_audit
- Clean → "end_success" | Violations → "developer"

Implement:

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Send

def supervisor_with_fanout(state: AgentState):
    """Supervisor runs, then fans out to Researcher AND Persona in parallel."""
    updated = supervisor_node(state)
    return [
        Send("researcher", {**updated, "current_task_id": "research_001"}),
        Send("persona",    {**updated, "current_task_id": "persona_001"}),
    ]

def join_node(state: AgentState) -> AgentState:
    """Waits for both Phase 1 agents. Routes to Architect."""
    # Both research_output and personas should now be set
    return state

def end_success_node(state: AgentState) -> AgentState:
    state["status"] = "FINALIZED"
    return state

def end_failed_node(state: AgentState) -> AgentState:
    state["status"] = "FAILED"
    return state

builder = StateGraph(AgentState)

# Register all nodes
builder.add_node("supervisor", supervisor_with_fanout)
builder.add_node("researcher", researcher_node)
builder.add_node("persona", persona_node)
builder.add_node("join", join_node)
builder.add_node("architect", architect_node)
builder.add_node("developer", developer_node)
builder.add_node("critic", critic_node)
builder.add_node("auditor", auditor_node)
builder.add_node("end_success", end_success_node)
builder.add_node("end_failed", end_failed_node)

# Wire edges
builder.add_edge(START, "supervisor")
builder.add_edge("researcher", "join")
builder.add_edge("persona", "join")
builder.add_edge("join", "architect")
builder.add_edge("architect", "developer")
builder.add_edge("developer", "critic")

builder.add_conditional_edges("critic", route_after_critic, {
    "auditor": "auditor",
    "developer": "developer",
    "end_failed": "end_failed"
})

builder.add_conditional_edges("auditor", route_after_audit, {
    "end_success": "end_success",
    "developer": "developer"
})

builder.add_edge("end_success", END)
builder.add_edge("end_failed", END)

# Compile with memory checkpointer for state persistence between nodes
graph = builder.compile(checkpointer=MemorySaver())

Export: graph (the compiled graph) and get_initial_state from state.py
```

---

## PHASE 5 — FASTAPI SERVER + SSE STREAMING

### PROMPT 5.1 — FastAPI Main Server
```
Create backend/main.py for Orin AI. This is the production FastAPI server.

Requirements:
- Logfire instrumentation (auto-instruments all requests and LLM calls)
- SSE streaming via sse-starlette
- CORS enabled for Next.js frontend on localhost:3000
- Async throughout (all endpoints async)

Implement ALL endpoints from the API contract:

1. POST /run
   - Request body: {"prompt": str}
   - Creates new run_id (uuid4)
   - Creates asyncio.Queue for this run_id in run_queues dict
   - Launches execute_pipeline() as asyncio background task
   - Returns: {"run_id": str} immediately (non-blocking)

2. GET /stream/{run_id}
   - SSE endpoint using EventSourceResponse
   - Reads from run_queues[run_id] asyncio.Queue
   - Yields each event as JSON
   - Closes when event["status"] in ["FINALIZED", "FAILED"]
   - 30 second timeout per event read

3. GET /status/{run_id}
   - Returns current status from run_states dict
   - Fallback polling endpoint if SSE connection drops

4. GET /artifacts/{run_id}
   - Returns {"files": {filename: code_content}}
   - Reads from run_artifacts dict

5. GET /trace/{run_id}
   - Returns Logfire trace URL for this run
   - Format: {"trace_url": f"https://logfire.pydantic.dev/.../{run_id}"}

6. GET /health
   - Returns {"status": "ok", "e2b": bool, "tavily": bool}
   - Calls validate_e2b_connection() and a simple Tavily ping

Implement execute_pipeline(run_id, prompt, queue):
   - Builds initial AgentState from get_initial_state(prompt)
   - Runs graph.stream() (LangGraph streaming)
   - For each streamed event: put structured SSE event into queue
   - SSE event structure:
     {
       "event_type": "agent_start|agent_complete|test_result|status_update",
       "agent": str,
       "task_id": str,
       "iteration": int,
       "payload": dict,
       "timestamp": ISO8601 string
     }
   - On completion: set run_states[run_id] = final status
   - On exception: put error event into queue, set status FAILED

Add Logfire setup at top of file:
import logfire
logfire.configure()
# instrument AFTER app creation:
logfire.instrument_fastapi(app)
```

---

## PHASE 6 — OBSERVABILITY

### PROMPT 6.1 — Logfire Integration Hardening
```
Update all agent files in backend/agents/ to add production-quality Logfire tracing.

For each agent file, update the node function to include detailed span attributes:

backend/agents/supervisor.py — update supervisor_node:
with logfire.span("supervisor_agent",
    goal_preview=state["goal"][:100],
    task_count=len(state.get("task_graph", []))
):

backend/agents/researcher.py — update researcher_node:
with logfire.span("researcher_agent",
    model_used="groq-llama3-70b",  # or "gpt-4o-mini" if fallback
    goal_preview=state["goal"][:100]
):

backend/agents/developer.py — update developer_node:
with logfire.span("developer_agent",
    iteration=state["iteration_count"],
    mode=state["mode"],
    task_id=state["current_task_id"]
):
    with logfire.span("e2b_sandbox_execution"):
        # E2B code goes here
        logfire.info("test_complete",
            passed=test_run.passed,
            exit_code=test_run.exit_code,
            stdout_preview=test_run.stdout[:200],
            stderr_preview=test_run.stderr[:200]
        )

backend/agents/critic.py — update critic_node:
with logfire.span("critic_node",
    passed=passed,
    iteration=state["iteration_count"],
    reason=reason[:100]
):

backend/agents/auditor.py — update auditor_node:
with logfire.span("auditor_agent",
    violations_found=len(violations),
    audit_passed=state["audit_passed"],
    files_scanned=len(state["code_files"])
):

Also add a utils/logfire_helpers.py file:
import logfire

def log_llm_call(agent_name: str, model: str, prompt_tokens: int, completion_tokens: int):
    logfire.info("llm_call",
        agent=agent_name,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        estimated_cost_usd=round((prompt_tokens * 0.000003) + (completion_tokens * 0.000015), 5)
    )

This gives judges the token cost per run — a key demo metric.
```

---

## PHASE 7 — INTEGRATION TESTING

### PROMPT 7.1 — End-to-End Test Suite
```
Create backend/tests/test_pipeline.py — a pytest test file that validates the full Orin AI pipeline.

Do NOT use mocking for E2B or external APIs in these tests. Write actual integration tests.

Test 1 — AgentState integrity:
def test_agent_state_initialization():
    state = get_initial_state("Build a FastAPI todo app")
    assert state["goal"] == "Build a FastAPI todo app"
    assert state["status"] == "RUNNING"
    assert state["iteration_count"] == 0
    assert state["mode"] == "normal"
    assert state["test_results"] == []

Test 2 — Panic mode trigger:
def test_panic_mode_activates_at_iteration_3():
    state = get_initial_state("test goal")
    state["iteration_count"] = 3
    mode = get_developer_prompt_mode(state)
    assert mode == "panic"

Test 3 — Critic routing logic:
def test_route_after_critic_pass():
    state = get_initial_state("test")
    state["test_results"] = [TestRun(0, "1 passed", "", 0, True)]
    state["iteration_count"] = 1
    route = route_after_critic(state)
    assert route == "auditor"

def test_route_after_critic_fail_retry():
    state = get_initial_state("test")
    state["test_results"] = [TestRun(0, "", "ModuleNotFoundError", 1, False)]
    state["iteration_count"] = 1
    route = route_after_critic(state)
    assert route == "developer"

def test_route_after_critic_max_iterations():
    state = get_initial_state("test")
    state["iteration_count"] = 6
    route = route_after_critic(state)
    assert route == "end_failed"

Test 4 — Context builder truncation:
def test_build_agent_context_truncates_failures():
    state = get_initial_state("test goal")
    state["test_results"] = [
        TestRun(i, "stdout", "x" * 1000, 1, False)
        for i in range(5)
    ]
    context = build_agent_context(state)
    # Should only include last 2 failures
    assert context.count("Iteration") <= 2

Test 5 — E2B sandbox connectivity:
def test_e2b_connection():
    assert validate_e2b_connection() == True

Test 6 — Auditor regex scan catches secrets:
def test_auditor_catches_hardcoded_key():
    code_files = {"app.py": 'API_KEY = "sk-abcdef1234567890abcdef1234567890"'}
    violations = regex_scan(code_files)
    assert len(violations) > 0
    assert any(v["type"] == "hardcoded_secret" for v in violations)

Add a conftest.py that loads .env before all tests.
```

---

### PROMPT 7.2 — Adversarial Demo Test
```
Create backend/tests/test_self_healing.py — this validates the signature demo moment.

This test MUST pass for the demo to work. Run it the night before the hackathon.

def test_self_healing_wrong_library():
    """
    DEMO TEST: Orin AI must self-heal from a non-existent library name.
    This is the centerpiece of the demo — 'We built a workforce, not a tool.'
    
    Flow: Developer tries to import 'fastchroma' → E2B install fails →
    Critic fails → Developer retries with correct 'chromadb' → Tests pass
    """
    import asyncio
    from graph import graph
    from state import get_initial_state
    
    # Prompt that will cause a library resolution failure on first attempt
    state = get_initial_state(
        "Build a Python vector search service using chromadb for semantic search. "
        "Include a pytest test that adds 3 documents and queries them."
    )
    
    # Override developer to intentionally use wrong lib on first iteration
    # (Simulate the demo scenario)
    
    config = {"configurable": {"thread_id": "demo-test-001"}}
    result = asyncio.run(graph.ainvoke(state, config))
    
    assert result["status"] == "FINALIZED", f"Pipeline failed: {result['error_log']}"
    assert result["audit_passed"] == True
    assert len(result["test_results"]) >= 1
    assert result["test_results"][-1].passed == True
    
    print(f"Self-healing completed in {result['iteration_count']} iterations")
    print(f"Final test output: {result['test_results'][-1].stdout[:500]}")

Run this test 3 times before the demo. It must pass all 3 times.
Print the iteration count — if it self-heals in 2 iterations consistently, you have your demo.
```

---

## PHASE 8 — PRODUCTION HARDENING

### PROMPT 8.1 — Error Handling & Resilience
```
Update backend/main.py and all agent files with production-grade error handling.

Add to main.py:

1. Global exception handler:
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logfire.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse({"error": "Internal error", "detail": str(exc)}, status_code=500)

2. Run state cleanup (prevent memory leak in long hackathon sessions):
import asyncio
async def cleanup_old_runs():
    """Remove runs older than 2 hours from memory."""
    while True:
        await asyncio.sleep(3600)
        cutoff = time.time() - 7200
        expired = [rid for rid, t in run_timestamps.items() if t < cutoff]
        for rid in expired:
            run_queues.pop(rid, None)
            run_states.pop(rid, None)
            run_artifacts.pop(rid, None)

3. Add to all agent nodes — graceful degradation pattern:
def safe_node_wrapper(node_fn):
    """Wraps any agent node to catch exceptions and update error_log instead of crashing."""
    def wrapper(state: AgentState) -> AgentState:
        try:
            return node_fn(state)
        except Exception as e:
            logfire.error(f"{node_fn.__name__}_failed", error=str(e))
            state["error_log"].append(f"{node_fn.__name__}: {str(e)}")
            return state
    return wrapper

Apply safe_node_wrapper to: researcher_node, persona_node, architect_node
Do NOT wrap developer_node or critic_node — their failures are expected and handled by routing.

4. Add request ID to all log spans:
import uuid
@app.middleware("http")
async def add_request_id(request, call_next):
    request_id = str(uuid.uuid4())[:8]
    with logfire.span("http_request", request_id=request_id, path=request.url.path):
        response = await call_next(request)
    return response
```

---

### PROMPT 8.2 — Environment Validation on Startup
```
Create backend/startup_check.py for Orin AI. Run this before uvicorn starts.

def validate_environment():
    """
    Validates all required API keys and external service connections.
    Fails fast with clear error messages rather than mysterious runtime errors.
    """
    required_keys = {
        "ANTHROPIC_API_KEY": "Claude agents (Supervisor, Architect, Developer, Auditor)",
        "GROQ_API_KEY": "Researcher and Persona agents (fast inference)",
        "TAVILY_API_KEY": "Market research search",
        "E2B_API_KEY": "Code execution sandbox (CRITICAL — demo breaks without this)",
        "LOGFIRE_TOKEN": "Observability dashboard (open during demo)",
    }
    
    optional_keys = {
        "OPENAI_API_KEY": "GPT-4o-mini fallback if Groq rate-limits",
    }
    
    errors = []
    warnings = []
    
    for key, description in required_keys.items():
        value = os.getenv(key)
        if not value or value.endswith("..."):
            errors.append(f"MISSING: {key} — needed for {description}")
    
    for key, description in optional_keys.items():
        if not os.getenv(key):
            warnings.append(f"OPTIONAL MISSING: {key} — {description}")
    
    if warnings:
        for w in warnings:
            print(f"⚠️  {w}")
    
    if errors:
        print("\n❌ Orin AI startup FAILED. Fix these before demo:\n")
        for e in errors:
            print(f"   {e}")
        sys.exit(1)
    
    # Test actual connectivity
    print("✅ All API keys present. Testing connections...")
    
    # Test E2B
    try:
        from tools.e2b_tools import validate_e2b_connection
        assert validate_e2b_connection()
        print("✅ E2B sandbox: connected")
    except Exception as e:
        print(f"❌ E2B sandbox FAILED: {e}")
        sys.exit(1)
    
    print("\n✅ Orin AI ready. Starting server...\n")

Call this at the top of main.py before app initialization.
```

---

## PHASE 9 — DEMO PREPARATION SCRIPTS

### PROMPT 9.1 — Demo Warm-Up Script
```
Create backend/demo_warmup.py — run this 30 minutes before the hackathon demo.

"""
Orin AI Demo Warm-Up Script
Run this 30 minutes before demo: python demo_warmup.py
"""

import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

DEMO_PROMPTS = [
    # Happy path demo prompt (run this live)
    "Build a FastAPI REST API for a task manager with JWT authentication, PostgreSQL database, and a full pytest test suite with at least 5 tests.",
    
    # Adversarial demo prompt (the mic-drop moment)
    "Build a Python service using fastchroma for vector search with semantic similarity. Include pytest tests.",
]

async def warmup():
    from graph import graph
    from state import get_initial_state
    
    print("🔥 Orin AI Demo Warm-Up\n")
    
    for i, prompt in enumerate(DEMO_PROMPTS):
        print(f"Running test {i+1}/{len(DEMO_PROMPTS)}: {prompt[:60]}...")
        
        state = get_initial_state(prompt)
        config = {"configurable": {"thread_id": f"warmup-{i}"}}
        
        start = asyncio.get_event_loop().time()
        result = await graph.ainvoke(state, config)
        elapsed = asyncio.get_event_loop().time() - start
        
        status = result["status"]
        iterations = result["iteration_count"]
        final_test = result["test_results"][-1] if result["test_results"] else None
        
        print(f"  Status: {status}")
        print(f"  Iterations: {iterations}")
        print(f"  Tests passed: {final_test.passed if final_test else 'N/A'}")
        print(f"  Time: {elapsed:.1f}s")
        
        if status == "FINALIZED":
            print(f"  ✅ READY FOR DEMO\n")
        else:
            print(f"  ❌ DEMO AT RISK — Errors: {result['error_log']}\n")
    
    print("Warm-up complete. Open Logfire dashboard now.")
    print("Bookmark your trace URLs before going on stage.")

if __name__ == "__main__":
    asyncio.run(warmup())
```

---

### PROMPT 9.2 — README Generation
```
Create README.md for Orin AI with the following sections. Use the project brief as the source of truth.

# Orin AI — Autonomous Product Lifecycle Engine

## One Line
One prompt. No human in the loop. Working, tested, audited code in under 10 minutes.

## What It Builds Autonomously
(list the full lifecycle: User Prompt → Market Research → Personas → Architecture → Code+Test Loop → Security Audit → MVP)

## Architecture
(include the 4-phase breakdown from the brief: Parallel discovery, Blueprint, Production Loop, Security Gate)

## The Five Agents
(table: Agent | Model | Role | Key Tool)

## Self-Healing Demo
(explain the adversarial prompt demo — wrong library → error → search → fix → pass)

## Tech Stack
(table from the brief: LangGraph, FastAPI, E2B, Tavily, Logfire, Groq, Next.js 14)

## Setup
(environment setup steps from the brief: git clone → pip install → .env → uvicorn)

## API Endpoints
(the full API contract table from the brief)

## Cost Per Run
(approx $0.05–$0.30 per run — cite this from Logfire token tracking)

## What Orin AI Is NOT
(the comparison table from the brief: vs Cursor, vs Devin, vs ChatGPT+Code Interpreter, vs n8n)
```

---

## EXECUTION ORDER CHECKLIST

```
DAY 1 MORNING (follow PDF timeline exactly):
[ ] PROMPT 0.1 — Project scaffold
[ ] PROMPT 0.2 — Prompt files
[ ] PROMPT 1.1 — AgentState schema  ← AGREE ON THIS FIRST, TEAM-WIDE
[ ] PROMPT 2.1 — E2B tools
[ ] PROMPT 2.2 — Tavily tools
[ ] PROMPT 3.5 — Developer agent + E2B loop  ← BUILD THIS BEFORE ANYTHING ELSE
[ ] PROMPT 3.6 — Critic node + routing  ← TEST RETRY LOOP WORKS
[ ] PROMPT 4.1 — Graph assembly (stubs OK at this stage)
[ ] PROMPT 5.1 — FastAPI + SSE

DAY 1 AFTERNOON:
[ ] PROMPT 3.1 — Supervisor agent
[ ] PROMPT 3.2 — Researcher agent (Tavily)
[ ] PROMPT 3.3 — Persona agent
[ ] PROMPT 3.4 — Architect agent
[ ] PROMPT 6.1 — Logfire hardening
[ ] PROMPT 8.2 — Startup validation

DAY 1 NIGHT (midnight target):
[ ] PROMPT 7.1 — Integration tests
[ ] Full pipeline run: "Build a FastAPI todo app with JWT auth and pytest tests"
[ ] Pipeline must complete end-to-end before sleep

DAY 2 MORNING:
[ ] Frontend (AgentFeed, TerminalPanel, ArtifactPanel — see PDF Section 08)
[ ] PROMPT 7.2 — Adversarial self-healing test (run 3 times, must pass all 3)
[ ] PROMPT 3.7 — Auditor agent

DAY 2 AFTERNOON:
[ ] PROMPT 8.1 — Error handling hardening
[ ] PROMPT 9.1 — Demo warm-up script
[ ] PROMPT 9.2 — README
[ ] Demo rehearsal x3 (PDF Section 13 script — 4 minutes exactly)
[ ] Record backup demo video
```
