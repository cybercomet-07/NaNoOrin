# TODO: Phase 5 — FastAPI server + SSE streaming
# Endpoints: POST /run, GET /stream/{run_id}, GET /status/{run_id},
#            GET /artifacts/{run_id}, GET /trace/{run_id}, GET /health

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logfire

# TODO: import execute_pipeline, graph, get_initial_state
# TODO: import validate_e2b_connection from tools.e2b_tools

app = FastAPI(title="Orin AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logfire.configure()
logfire.instrument_fastapi(app)

# In-memory run state stores
run_queues: dict = {}
run_states: dict = {}
run_artifacts: dict = {}
run_timestamps: dict = {}


@app.get("/health")
async def health():
    # TODO: call validate_e2b_connection() and Tavily ping
    return {"status": "ok", "e2b": False, "tavily": False}


@app.post("/run")
async def run(body: dict):
    # TODO: create run_id, launch execute_pipeline as background task
    pass


@app.get("/stream/{run_id}")
async def stream(run_id: str):
    # TODO: SSE via EventSourceResponse, read from run_queues[run_id]
    pass


@app.get("/status/{run_id}")
async def status(run_id: str):
    # TODO: return run_states[run_id]
    pass


@app.get("/artifacts/{run_id}")
async def artifacts(run_id: str):
    # TODO: return run_artifacts[run_id]
    pass


@app.get("/trace/{run_id}")
async def trace(run_id: str):
    # TODO: return Logfire trace URL
    pass


async def execute_pipeline(run_id: str, prompt: str, queue):
    # TODO: build AgentState, run graph.stream(), emit SSE events to queue
    pass
