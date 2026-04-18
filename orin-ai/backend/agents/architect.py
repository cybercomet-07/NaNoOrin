# TODO: Phase 3 — Architect Agent (Technical Architecture)
# Reference: execution_plan.md PROMPT 3.4
# Model: Claude claude-sonnet-4-20250514 (highest quality needed)
# Input: goal + research_output + personas
# Output: Architecture dataclass

import json
import logfire
from anthropic import Anthropic
from dotenv import load_dotenv

from state import AgentState, Architecture

load_dotenv()

# TODO: initialise Anthropic client


def generate_architecture(state: AgentState) -> Architecture:
    """
    Calls Claude to produce a complete technical architecture as JSON.
    Output: docker-compose.yml content, SQLAlchemy models, OpenAPI YAML spec, tech rationale.
    Validates all 4 fields are non-empty strings — raises ValueError if not.
    """
    # TODO: implement
    pass


def architect_node(state: AgentState) -> AgentState:
    """LangGraph node — generates architecture and sets state["architecture"]."""
    with logfire.span("architect_agent", goal=state["goal"][:50]):
        # TODO: call generate_architecture(), set state["architecture"]
        pass
    return state
