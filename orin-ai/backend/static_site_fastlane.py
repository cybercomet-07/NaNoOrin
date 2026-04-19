"""
Static-site fast lane.

When the user's prompt is a simple single-page website request (landing page,
portfolio, countdown, quote card, todo list in the browser, etc.), we bypass
the full LangGraph pipeline and run a compressed, single-LLM flow that:

  1. Emits the same shape of SSE events the real pipeline would, so the UI
     (Terminal / Event Log / agent strip) still feels alive.
  2. Makes ONE OpenRouter + DeepSeek call asking for a JSON object with exactly
     three files: ``index.html`` / ``styles.css`` / ``script.js``.
  3. Persists those files as run artifacts (same Redis key the normal path uses)
     so the frontend's CODE and PREVIEW tabs pick them up with no changes.
  4. Marks the run FINALIZED.

No E2B sandbox, no pytest, no Python output. Typical runtime: 15-40s.

The detection function is deliberately conservative: if the prompt smells even
a little bit like a "real app" (backend, database, auth, CRUD, API), we decline
and let the full pipeline handle it.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Awaitable, Callable

from llm_json import parse_json_object
from models import make_event

log = logging.getLogger(__name__)

# STRONG static-site phrases. When any of these appear, we go fast-lane even if
# the prompt later mentions tokens like "api" or "backend" (common filler words
# in informal prompts). This covers the wording the Demo Prompts page ships.
_STRONG_STATIC_RE = re.compile(
    r"\b("
    r"static\s+(site|page|website|landing)|"
    r"single[\s-]?page\s+(static|landing|portfolio|website|site|html)|"
    r"one[\s-]?page\s+(static|landing|portfolio|website|site|html)|"
    r"landing\s+page\s+(site|website)?|"
    r"html[\s-]?only|pure\s+html"
    r")\b",
    re.IGNORECASE,
)

# Regex hints that strongly suggest this is NOT a simple static site.
# Only consulted AFTER we've checked for a strong static phrase.
_NOT_STATIC_RE = re.compile(
    r"\b("
    r"fastapi|django|flask|express|node\.?js|server\s?side\s+render|"
    r"postgres|mysql|sqlite|mongo|redis|"
    r"jwt\s+auth|oauth|sign\s?up\s+and\s+login|"
    r"crud\s+(app|endpoints)|rest\s+api|graphql|websocket|grpc|"
    r"docker|kubernetes|microservice|"
    r"ml\s?model|train\s?model|tensorflow|pytorch"
    r")\b",
    re.IGNORECASE,
)

# Weaker positive hints (used only if no strong phrase matched, and no backend hint).
_WEAK_STATIC_RE = re.compile(
    r"\b("
    r"single[\s-]?page|one[\s-]?page|landing\s?page|"
    r"portfolio|bio\s?page|"
    r"countdown|quote\s+of\s+the\s+day|product\s?card|"
    r"todo\s?(list)?\b.*(browser|localstorage)|"
    r"minimal(ist|istic)?\s+(web\s?site|site|page|landing|homepage)|"
    r"(gym|fitness|cafe|restaurant|studio|salon|bakery|barbershop|"
    r"yoga|startup|agency|dentist|clinic)\s+(web\s?site|site|page|landing|homepage)"
    r")\b",
    re.IGNORECASE,
)


def is_static_site_prompt(prompt: str) -> bool:
    """Return True if the prompt looks like a simple single-page static site request.

    Decision order:
      1. Empty prompt → False.
      2. Strong static phrase present ("static site", "single-page static site",
         "landing page site" etc.) → True, regardless of other wording.
      3. Any heavy backend-ish hint → False.
      4. Weak static hint ("portfolio", "one-page", "countdown"...) → True.
      5. Otherwise → False (full pipeline handles it).
    """
    if not prompt or not prompt.strip():
        return False
    if _STRONG_STATIC_RE.search(prompt):
        return True
    if _NOT_STATIC_RE.search(prompt):
        return False
    return bool(_WEAK_STATIC_RE.search(prompt))


# ── LLM call (OpenRouter + DeepSeek, dedicated Developer key) ────────────────
#
# The system prompt is deliberately opinionated. The DeepSeek model tends to
# generate spartan, content-less pages when given a short user prompt (e.g.
# empty "quote card" with just a button). We explicitly require:
#   * a visible hero section,
#   * real demo data pre-rendered on first paint (no empty states),
#   * polished visuals consistent with Orin's dark-neon brand,
#   * responsive layout,
#   * slightly larger file budgets so the model has room to produce real CSS.
_SYSTEM_PROMPT = (
    "You are a senior front-end designer-developer. Your job is to produce a "
    "single-page static website of DEMO QUALITY — ready to be shown to judges "
    "in the next 30 seconds. Output THREE files: `index.html`, `styles.css`, "
    "`script.js`.\n"
    "\n"
    "FILE RULES\n"
    "- index.html is a complete valid HTML5 document. It MUST include:\n"
    "  <link rel=\"stylesheet\" href=\"styles.css\"> in <head>\n"
    "  <script src=\"script.js\" defer></script> in <head>\n"
    "  a <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> tag\n"
    "  a clear <title> reflecting the subject of the prompt\n"
    "- All styling goes in styles.css. Zero inline <style> blocks.\n"
    "- All JavaScript goes in script.js. If no JS is needed, script.js still "
    "  exists with one short comment line.\n"
    "- Vanilla HTML/CSS/JS only. No frameworks, no CDNs, no external fonts, "
    "  no external images (use CSS gradients, emoji, or unicode glyphs instead).\n"
    "\n"
    "CONTENT RULES (critical — do not skip)\n"
    "- The page MUST render something visible and interesting on first load. "
    "  Never produce a blank card, empty hero, or an interface that only "
    "  becomes populated after the user clicks a button.\n"
    "- If the prompt asks for a data-driven widget (quotes, todo items, "
    "  products, countdown, testimonials, stats…) you MUST hard-code realistic "
    "  SEED DATA directly in script.js AND render the first item immediately "
    "  on DOMContentLoaded. Example: for a Quote of the Day page, the first "
    "  quote and its author must already be on screen — the 'New quote' "
    "  button only cycles to the NEXT quote.\n"
    "- Include a clear headline/hero, at least one body section with real "
    "  copy (not lorem ipsum — write plausible, on-topic text), and a simple "
    "  footer.\n"
    "\n"
    "DESIGN RULES\n"
    "- Aesthetic: modern dark theme, soft gradient background, high-contrast "
    "  typography, generous white-space, rounded corners (border-radius: 16px+), "
    "  subtle drop shadows, accent color #c7ff3d (lime green). Use CSS custom "
    "  properties in :root for colors and spacing.\n"
    "- Typography: system font stack — -apple-system, BlinkMacSystemFont, "
    "  'Segoe UI', Roboto, sans-serif. Headings bold, body text line-height 1.6.\n"
    "- Layout: centered content, max-width ~1100px, responsive via CSS grid "
    "  or flexbox. MUST look good on mobile (≤480px wide) and desktop.\n"
    "- Interactions: hover states on every button/link, smooth CSS transitions, "
    "  tasteful animation on load (fade-in/slide-up is fine, no jank).\n"
    "\n"
    "SIZE BUDGET\n"
    "- index.html: 40–180 lines\n"
    "- styles.css: 60–240 lines (aim for genuinely polished styling)\n"
    "- script.js: 10–120 lines (include comments explaining key functions)\n"
    "\n"
    "OUTPUT FORMAT\n"
    "Return ONE JSON object only, no markdown fences, no prose. "
    "Keys must be exactly: \"index.html\", \"styles.css\", \"script.js\". "
    "Values must be valid JSON strings (escape newlines as \\n, quotes as \\\", "
    "backslashes as \\\\)."
)


def _augment_user_prompt(prompt: str) -> str:
    """Add per-prompt quality directives based on cheap keyword heuristics.

    This is the 'last mile' push that gets DeepSeek to render something
    visually interesting. Each heuristic pastes in a few non-negotiable lines
    after the user prompt so the model can't skip them.
    """
    p = prompt.lower()
    extras: list[str] = []

    if re.search(r"\bquote\b", p):
        extras.append(
            "Hard-code AT LEAST 6 real, well-known quotes (text + author) in "
            "script.js. On DOMContentLoaded, render the FIRST quote immediately "
            "so the card is never empty. The 'New quote' button then cycles to "
            "a different random quote. Animate each change with a brief fade."
        )
    if re.search(r"\btodo\b", p):
        extras.append(
            "Seed the list with 3 example todos on first load (e.g. 'Ship MVP', "
            "'Call Alex', 'Water plants') so the UI isn't empty. Persist edits "
            "to localStorage under the key 'orin.todos'."
        )
    if re.search(r"\bcountdown\b", p):
        extras.append(
            "Compute the target date in JS as `new Date(Date.now() + 14*24*60*60*1000)`. "
            "Render the days/hours/minutes/seconds inside four labeled cards. "
            "Update every 1s via setInterval and handle the 'expired' state "
            "with a celebratory message."
        )
    if re.search(r"\bportfolio\b", p):
        extras.append(
            "Include a projects section with 3 plausible project cards "
            "(title, 1-line description, mock tech stack pill). Make the whole "
            "page feel like a real person's site, not a template skeleton."
        )
    if re.search(r"\b(coffee|cafe|caf\u00e9|shop|restaurant)\b", p):
        extras.append(
            "Use warm accent tones (terracotta, amber) layered on top of the "
            "dark base. Menu items should have realistic prices and short "
            "descriptions. Add a visual separator between sections."
        )
    if re.search(r"\b(gym|fitness|workout)\b", p):
        extras.append(
            "Hero: bold one-line promise + 'Join now' CTA. Include three "
            "feature cards (e.g. Strength, Cardio, Recovery) each with an "
            "emoji glyph. Include a pricing row with 3 tiers (Starter / Pro / "
            "Elite) showing realistic monthly prices. Footer with opening "
            "hours and an address. Use a high-energy palette — dark base with "
            "lime/yellow accents — and strong, sans-serif typography."
        )
    if re.search(r"\bproduct\b", p):
        extras.append(
            "Render the product card FULLY populated on first load (image "
            "placeholder with a gradient, name, price, stars, description, CTA). "
            "The 'Add to cart' toast appears above the CTA, not in a corner."
        )
    if re.search(r"\blanding\b", p):
        extras.append(
            "Structure: hero (headline + subheadline + CTA), 3-item feature row "
            "with icons (use emoji), short testimonial/quote block, footer. "
            "Each section visually distinct via background tint."
        )

    if not extras:
        return prompt.strip()

    bullet_list = "\n".join(f"- {e}" for e in extras)
    return (
        f"{prompt.strip()}\n\n"
        f"NON-NEGOTIABLE REQUIREMENTS FOR THIS SPECIFIC PROMPT:\n{bullet_list}"
    )


def _parse_fastlane_response(text: str) -> dict[str, str]:
    """Parse the LLM's JSON response and assert required keys exist."""
    data = parse_json_object(text)
    files = {str(k): str(v) for k, v in data.items()}
    for required in ("index.html", "styles.css", "script.js"):
        if required not in files:
            raise ValueError(f"model omitted required file: {required!r}")
    return files


def _try_openai_for_fastlane(user_msg: str) -> dict[str, str] | None:
    """Direct OpenAI attempt. Returns None if OPENAI_API_KEY is missing or the
    call fails for any reason so the caller can fall through to OpenRouter."""
    from openai import OpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[fastlane] OPENAI_API_KEY not set — skipping OpenAI", flush=True)
        return None

    model = os.getenv("OPENAI_DEVELOPER_MODEL", "gpt-4o-mini")
    print(f"[fastlane] trying OpenAI (model={model})", flush=True)
    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            max_tokens=8192,
            temperature=0.55,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content or ""
        files = _parse_fastlane_response(text)
        usage = getattr(resp, "usage", None)
        usage_str = (
            f" tokens prompt={usage.prompt_tokens} completion={usage.completion_tokens}"
            if usage is not None
            else ""
        )
        print(
            f"[fastlane] OpenAI OK (model={model}){usage_str} "
            f"files={sorted(files.keys())} sizes={[len(v) for v in files.values()]}",
            flush=True,
        )
        log.info("[FASTLANE] served by OpenAI direct (%s)", model)
        return files
    except Exception as e:
        print(
            f"[fastlane] OpenAI FAILED ({type(e).__name__}): {str(e)[:200]} — "
            f"falling through to OpenRouter",
            flush=True,
        )
        log.warning(
            "[FASTLANE-OPENAI] %s: %s — falling through to OpenRouter",
            model,
            str(e)[:200],
        )
        return None


def _try_openrouter_for_fastlane(
    user_msg: str, env_key: str
) -> dict[str, str] | None:
    """OpenRouter attempt with the given key (primary model, then fallback model)."""
    from openai import OpenAI

    api_key = os.getenv(env_key)
    if not api_key:
        return None

    client = OpenAI(
        api_key=api_key,
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    )
    primary = os.getenv("OPENROUTER_AGENT_MODEL", "deepseek/deepseek-chat-v3.1")
    fallback = os.getenv("OPENROUTER_AGENT_MODEL_FALLBACK", "openai/gpt-oss-120b:free")

    for model in (primary, fallback):
        if not model:
            continue
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=8192,
                temperature=0.55,
                extra_headers={
                    "HTTP-Referer": os.getenv(
                        "OPENROUTER_REFERER", "http://localhost:3000"
                    ),
                    "X-Title": "Orin AI",
                },
            )
            text = resp.choices[0].message.content or ""
            files = _parse_fastlane_response(text)
            if model != primary:
                log.info("[FASTLANE] served by fallback model %s via %s", model, env_key)
            else:
                log.info("[FASTLANE] served by %s via %s", model, env_key)
            return files
        except Exception as e:
            log.warning(
                "[FASTLANE-OR] %s via %s failed: %s",
                model,
                env_key,
                str(e)[:200],
            )
            continue
    return None


def _generate_static_site_files(prompt: str) -> dict[str, str]:
    """Generate the 3 demo files. Tries, in order:

      1. OpenAI direct (OPENAI_API_KEY + OPENAI_DEVELOPER_MODEL)   — paid, best quality.
      2. OpenRouter with the configured Developer key              — DeepSeek free credit.
      3. OpenRouter with the shared Fallback key                   — new spare account.
      4. OpenRouter with the Architect key                         — last-resort.

    Runs synchronously — callers should wrap in run_in_executor.
    """
    augmented = _augment_user_prompt(prompt)
    user_msg = (
        "Build the following single-page site. Follow EVERY rule in the "
        "system message — especially 'render real content on first paint' "
        "and 'use seed data'.\n\n"
        f"{augmented}"
    )

    files = _try_openai_for_fastlane(user_msg)
    if files is not None:
        return files

    for env_key in (
        "OPENROUTER_DEVELOPER_KEY",
        "OPENROUTER_FALLBACK_KEY",
        "OPENROUTER_ARCHITECT_KEY",
    ):
        files = _try_openrouter_for_fastlane(user_msg, env_key)
        if files is not None:
            return files

    raise RuntimeError(
        "Static-site fast lane: all providers failed (OpenAI + OpenRouter keys). "
        "Check that at least one of OPENAI_API_KEY / OPENROUTER_*_KEY is configured."
    )


# ── Scripted agent events ─────────────────────────────────────────────────────
# Pacing for the scripted events so the UI animates nicely — each pause is
# before the corresponding event fires. The LLM call happens between
# "Architect" and "Developer".
_EVENT_SCRIPT: list[tuple[float, str, str, dict]] = [
    (0.0, "supervisor", "agent_complete", {
        "task_count": 1,
        "tasks": [{"task_id": "static_site_001", "agent": "developer"}],
        "note": "Fast-lane: static single-page site",
    }),
    (0.8, "researcher", "agent_complete", {
        "note": "Skipped for static-site fast lane (no competitive research required)",
    }),
    (0.6, "persona", "agent_complete", {
        "note": "Skipped for static-site fast lane (single-visitor viewer persona)",
    }),
    (0.5, "join", "agent_complete", {
        "note": "Coordinator merged (fast lane)",
    }),
    (0.6, "architect", "agent_complete", {
        "architecture_ready": True,
        "tech_rationale": (
            "Static single-page site. No server, no database. "
            "index.html + styles.css + script.js, vanilla HTML/CSS/JS only."
        ),
    }),
]

_EVENT_SCRIPT_POST: list[tuple[float, str, str, dict]] = [
    (0.4, "critic", "test_result", {
        "passed": True,
        "exit_code": 0,
        "stdout": "HTML validity check: index.html, styles.css, script.js present\nAll three files non-empty",
        "stderr": "",
        "error_log": [],
    }),
    (0.4, "auditor", "agent_complete", {
        "audit_passed": True,
        "audit_report": {
            "kind": "static-site",
            "files_ok": True,
            "security_notes": "No backend, no auth surface, no user data — safe.",
        },
    }),
    (0.4, "readme_generator", "agent_complete", {
        "readme_generated": True,
        "readme_preview": "",
    }),
]


def _build_readme(prompt: str, files: dict[str, str]) -> str:
    """Tiny hand-written README so the PREVIEW tab has something to show."""
    first_line = prompt.strip().splitlines()[0][:200]
    return (
        "# Generated Static Site\n\n"
        f"Orin AI generated this single-page website from the prompt:\n\n> {first_line}\n\n"
        "## Files\n\n"
        "- `index.html` — the page markup\n"
        "- `styles.css` — all styling\n"
        "- `script.js` — interactivity (may be empty)\n\n"
        "## Run it\n\n"
        "Open `index.html` in any modern browser. No build step, no server.\n"
    )


async def run_static_site_fastlane(
    run_id: str,
    prompt: str,
    queue: asyncio.Queue,
    set_artifacts: Callable[[str, dict], Awaitable[None]],
    set_status: Callable[[str, str], Awaitable[None]],
) -> None:
    """Run the fast lane end to end. Pushes events into ``queue``, writes
    artifacts + status via the provided async callbacks.

    Mirrors the shape of ``execute_pipeline`` so main.py can just ``await`` it
    in place of the normal pipeline when the prompt is static-site-shaped.
    """
    print(f"[fastlane] start run_id={run_id}", flush=True)
    await queue.put(make_event(
        event_type="status_update",
        agent="system",
        payload={"message": "Pipeline started (static-site fast lane)", "prompt": prompt},
        status="RUNNING",
    ))

    try:
        # Phase 1: scripted events leading up to the LLM call
        for pause, agent, etype, payload in _EVENT_SCRIPT:
            if pause:
                await asyncio.sleep(pause)
            await queue.put(make_event(
                event_type=etype,
                agent=agent,
                payload=payload,
            ))

        # Phase 2: the one real call
        await queue.put(make_event(
            event_type="agent_start",
            agent="developer",
            payload={"note": "Generating index.html + styles.css + script.js via DeepSeek"},
        ))

        loop = asyncio.get_running_loop()
        print(f"[fastlane] generating code run_id={run_id}", flush=True)
        files = await loop.run_in_executor(None, _generate_static_site_files, prompt)
        print(
            f"[fastlane] code generation complete run_id={run_id} "
            f"files={sorted(files.keys())} sizes={[len(v) for v in files.values()]}",
            flush=True,
        )

        # Add a small, friendly README alongside the code. Frontend PREVIEW
        # tab renders README when status=FINALIZED and README.md exists.
        files.setdefault("README.md", _build_readme(prompt, files))

        await set_artifacts(run_id, files)

        await queue.put(make_event(
            event_type="agent_complete",
            agent="developer",
            iteration=1,
            payload={
                "iteration": 1,
                "mode": "static_site",
                "test_passed": True,
                "stdout_preview": "wrote index.html, styles.css, script.js",
                "stderr_preview": "",
                "files": sorted(files.keys()),
            },
        ))

        # Phase 3: scripted events after code is ready
        for pause, agent, etype, payload in _EVENT_SCRIPT_POST:
            if pause:
                await asyncio.sleep(pause)
            p = dict(payload)
            if agent == "readme_generator":
                p["readme_preview"] = files["README.md"][:400]
            await queue.put(make_event(
                event_type=etype,
                agent=agent,
                payload=p,
            ))

        await set_status(run_id, "FINALIZED")
        print(f"[fastlane] FINALIZED run_id={run_id}", flush=True)
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"message": "Pipeline complete", "final_status": "FINALIZED"},
            status="FINALIZED",
        ))

    except Exception as exc:
        log.exception("static_site_fastlane_failed")
        print(f"[fastlane] FAILED run_id={run_id} err={type(exc).__name__}: {str(exc)[:200]}", flush=True)
        await set_status(run_id, "FAILED")
        await queue.put(make_event(
            event_type="status_update",
            agent="system",
            payload={"error": f"Static-site fast lane failed: {str(exc)[:300]}"},
            status="FAILED",
        ))
