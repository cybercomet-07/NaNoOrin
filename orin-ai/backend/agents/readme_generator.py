"""README generator — final documentation step after a successful audit (GAP 5)."""

from __future__ import annotations

import logfire

from llm_clients import call_agent_llm
from state import AgentState

README_SYSTEM_PROMPT = """You are a technical writer. Generate a professional README.md for the software project
that was just built. The README must be immediately usable — no placeholders.

Include:
1. Project name and one-line description
2. What it does (3-5 bullet points)
3. Tech stack used (from the architecture spec)
4. Installation instructions (from requirements.txt)
5. API endpoints (from the OpenAPI spec)
6. How to run tests
7. Environment variables needed (reference GROQ_API_KEY_1–4, TAVILY_API_KEY, E2B_API_KEY, LOGFIRE_TOKEN as in a typical Orin AI deployment; say to copy backend/.env from .env.example)
8. A "Built with Orin AI" line or badge text at the bottom

Format: Valid Markdown. Include fenced code blocks for shell commands. No placeholders like <YOUR_VALUE>."""


def generate_readme(state: AgentState) -> str:
    """Generates README.md body from pipeline state."""
    arch = state.get("architecture")
    code_files = dict(state.get("code_files") or {})

    docker_snip = (arch.docker_compose[:1500] if arch else "Not available")
    api_snip = (arch.api_spec[:2000] if arch else "Not available")
    schema_snip = (arch.db_schema[:1000] if arch else "Not available")
    rationale = (arch.tech_rationale[:2000] if arch else "Not available")

    req_txt = code_files.get("requirements.txt", "Not available")
    test_line = "All tests passed"
    if state.get("test_results"):
        test_line = "All tests passed" if state["test_results"][-1].passed else "Last test run did not pass — see logs"

    audit_line = "Clean — no security violations" if state.get("audit_passed") else "Completed with audit notes"

    user_message = f"""Goal: {state["goal"]}

Architecture:
- Tech rationale: {rationale}
- API spec (excerpt): {api_snip}
- DB schema (excerpt): {schema_snip}
- Docker compose (excerpt): {docker_snip}

Generated files: {list(code_files.keys())}

requirements.txt content:
{req_txt}

Tests: {test_line}
Audit: {audit_line}

Generate a complete, professional README.md for this project."""

    return (
        call_agent_llm(
            "architect",
            README_SYSTEM_PROMPT,
            user_message,
            messages_history=state.get("messages", []),
            max_tokens=2048,
            temperature=0.35,
        )
        or ""
    ).strip()


def readme_node(state: AgentState) -> dict:
    """LangGraph node — generates README and merges into code_files."""
    with logfire.span("readme_generator"):
        err_log: list[str] = []
        try:
            readme_content = generate_readme(state)
        except Exception as e:
            logfire.error("readme_generation_failed", error=str(e))
            err_log.append(f"readme_generator: {e}")
            readme_content = (
                f"# Generated project\n\n"
                f"README generation failed ({e!s}). See code files for the built app.\n\n"
                f"---\n*Built with Orin AI*\n"
            )

        files = dict(state.get("code_files") or {})
        files["README.md"] = readme_content
        logfire.info("readme_generated", length=len(readme_content))
        out: dict = {"code_files": files}
        if err_log:
            out["error_log"] = err_log
        return out
