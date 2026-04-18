"""Logfire helpers for LLM cost and observability."""

from __future__ import annotations

import logfire


def log_llm_call(
    agent_name: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    """Emit token usage and a rough USD estimate (demo metric for judges)."""
    logfire.info(
        "llm_call",
        agent=agent_name,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        estimated_cost_usd=round(
            (prompt_tokens * 0.000003) + (completion_tokens * 0.000015),
            5,
        ),
    )


def log_anthropic_usage(agent_name: str, model: str, msg: object) -> None:
    """Log usage from anthropic.messages.create() response."""
    u = getattr(msg, "usage", None)
    if not u:
        return
    inp = int(getattr(u, "input_tokens", None) or 0)
    out = int(getattr(u, "output_tokens", None) or 0)
    log_llm_call(agent_name, model, inp, out)


def log_chat_completion_usage(agent_name: str, model: str, completion: object) -> None:
    """Log usage from OpenAI / Groq chat.completions.create() response."""
    u = getattr(completion, "usage", None)
    if not u:
        return
    pt = getattr(u, "prompt_tokens", None)
    if pt is None:
        pt = getattr(u, "input_tokens", 0)
    ct = getattr(u, "completion_tokens", None)
    if ct is None:
        ct = getattr(u, "output_tokens", 0)
    log_llm_call(agent_name, model, int(pt or 0), int(ct or 0))
