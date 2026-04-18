# TODO: Phase 3 — Persona Agent (User Persona Generation)
# Reference: execution_plan.md PROMPT 3.3
# Model: Groq Llama 3 70B with GPT-4o-mini fallback
# Runs in PARALLEL with Researcher via LangGraph Send() API

import logfire
from groq import Groq
from openai import OpenAI
from dotenv import load_dotenv

from state import AgentState

load_dotenv()

# TODO: initialise Groq and OpenAI clients


def generate_personas(state: AgentState) -> str:
    """
    Generates 3 detailed user personas grounded in market research (if available).
    Returns JSON string — no markdown fences.
    Fields per persona: name, role, company_size, pain_points[], job_to_be_done, success_metric.
    Can run with research_output=None (truly parallel execution).
    """
    # TODO: implement
    pass


def persona_node(state: AgentState) -> AgentState:
    """LangGraph node — generates user personas and sets state["personas"]."""
    with logfire.span("persona_agent"):
        # TODO: call generate_personas(), set state["personas"]
        pass
    return state
