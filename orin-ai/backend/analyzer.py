"""
Repository / document analyzer extension.

Exposes `POST /analyze` which accepts either:
  - `repo_url`: a public Git repository URL (GitHub supported first-class,
    GitLab / Bitbucket fall back to pasted-text mode).
  - `text`: a raw README, plan, or spec pasted by the user.

It gathers context (README + top-level file tree for GitHub URLs), asks
Gemini to produce a structured project report in Markdown, and returns both
the rendered report and lightweight metadata so the frontend can render a
nice labeled view + download.

This extension is intentionally isolated from the main LangGraph pipeline —
it uses only its own Gemini key and does not share Groq / OpenRouter quotas.
"""

from __future__ import annotations

import base64
import os
import re
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

import httpx
import logfire
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/analyze", tags=["analyzer"])


# --------------------------------------------------------------------------- #
# Configuration                                                                 #
# --------------------------------------------------------------------------- #

_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
_GEMINI_MODEL_FALLBACK = (
    os.getenv("GEMINI_MODEL_FALLBACK", "gemini-2.5-flash-lite").strip()
    or "gemini-2.5-flash-lite"
)
_GEMINI_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)

# Hard caps — keep the prompt cheap and keep Gemini's input bounded.
_MAX_README_CHARS = 40_000
_MAX_FILE_LIST_ENTRIES = 120
_MAX_PASTED_TEXT = 80_000
_HTTP_TIMEOUT = 20.0


# --------------------------------------------------------------------------- #
# Request / response models                                                     #
# --------------------------------------------------------------------------- #


class AnalyzeRequest(BaseModel):
    repo_url: str | None = Field(
        default=None,
        description="Public GitHub/GitLab/Bitbucket URL to analyze.",
        max_length=500,
    )
    text: str | None = Field(
        default=None,
        description="Raw README / plan / spec text to analyze.",
        max_length=_MAX_PASTED_TEXT,
    )


class AnalyzeSource(BaseModel):
    kind: Literal["github", "url", "text"]
    label: str
    repo_owner: str | None = None
    repo_name: str | None = None
    default_branch: str | None = None
    files_sampled: int = 0
    readme_chars: int = 0


class AnalyzeResponse(BaseModel):
    report_markdown: str
    source: AnalyzeSource
    model: str


# --------------------------------------------------------------------------- #
# Source-fetching helpers                                                       #
# --------------------------------------------------------------------------- #


@dataclass
class _FetchedContext:
    label: str
    readme: str
    file_list: list[str]
    owner: str | None
    repo: str | None
    branch: str | None

    @property
    def kind(self) -> Literal["github", "url", "text"]:
        if self.owner and self.repo:
            return "github"
        if self.label.startswith("http"):
            return "url"
        return "text"


_GITHUB_URL_RE = re.compile(
    r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/?#]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)


def _parse_github(url: str) -> tuple[str, str] | None:
    """Return (owner, repo) if `url` points at a GitHub repository root."""
    url = url.strip()
    m = _GITHUB_URL_RE.match(url)
    if m:
        return m.group("owner"), m.group("repo")
    # Also accept "github.com/owner/repo" without scheme, or deep sub-paths.
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
    except ValueError:
        return None
    if parsed.netloc.lower() != "github.com":
        return None
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2:
        owner, repo = parts[0], parts[1]
        repo = repo.removesuffix(".git")
        if owner and repo:
            return owner, repo
    return None


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n\n…(truncated, original was {len(text):,} chars)"


async def _fetch_github(owner: str, repo: str) -> _FetchedContext:
    """Best-effort fetch of README + top-level file list for a public GitHub repo."""
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "orin-ai-analyzer"}
    base = f"https://api.github.com/repos/{owner}/{repo}"

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
        # 1. Repo metadata (for default_branch + visibility check).
        try:
            meta_resp = await client.get(base, headers=headers)
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Couldn't reach GitHub for {owner}/{repo}: {e}",
            ) from e

        if meta_resp.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Repository `{owner}/{repo}` not found, or it is private. "
                    "Public repos only — paste the README text instead if it's private."
                ),
            )
        if meta_resp.status_code == 403:
            raise HTTPException(
                status_code=429,
                detail=(
                    "GitHub rate-limited this server (no auth token). "
                    "Try again in a minute, or paste the README / plan text instead."
                ),
            )
        if meta_resp.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"GitHub returned {meta_resp.status_code} for {owner}/{repo}.",
            )

        meta = meta_resp.json() if meta_resp.content else {}
        branch = meta.get("default_branch") or "main"

        # 2. README (raw markdown).
        readme_text = ""
        try:
            r = await client.get(f"{base}/readme", headers=headers)
            if r.status_code == 200:
                payload = r.json()
                content_b64 = payload.get("content") or ""
                if content_b64:
                    try:
                        readme_text = base64.b64decode(content_b64).decode(
                            "utf-8", errors="replace"
                        )
                    except Exception:  # noqa: BLE001
                        readme_text = ""
        except httpx.HTTPError:
            readme_text = ""

        # 3. Top-level file tree (single API call, recursive=true).
        file_list: list[str] = []
        try:
            t = await client.get(
                f"{base}/git/trees/{branch}",
                params={"recursive": "1"},
                headers=headers,
            )
            if t.status_code == 200:
                tree = t.json().get("tree", [])
                for node in tree:
                    if not isinstance(node, dict):
                        continue
                    if node.get("type") == "blob":
                        path = node.get("path")
                        if isinstance(path, str):
                            file_list.append(path)
                # Favor "interesting" files first, cap at the limit.
                file_list = _prioritize_files(file_list)[:_MAX_FILE_LIST_ENTRIES]
        except httpx.HTTPError:
            pass

    return _FetchedContext(
        label=f"github.com/{owner}/{repo}",
        readme=_truncate(readme_text, _MAX_README_CHARS),
        file_list=file_list,
        owner=owner,
        repo=repo,
        branch=branch,
    )


# Common project-root files / directories we want to surface first.
_PRIORITY_FILES = (
    "readme",
    "license",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "setup.py",
    "dockerfile",
    "docker-compose",
    "tsconfig.json",
    "next.config",
    "vite.config",
    "cargo.toml",
    "go.mod",
    "main.py",
    "app.py",
    "index.ts",
    "index.js",
    ".env",
    "makefile",
    "schema.prisma",
)


def _prioritize_files(paths: list[str]) -> list[str]:
    head: list[str] = []
    tail: list[str] = []
    for p in paths:
        low = p.lower()
        if any(key in low for key in _PRIORITY_FILES):
            head.append(p)
        else:
            tail.append(p)
    # Stable sort inside each bucket, shortest (shallowest) paths first.
    head.sort(key=lambda s: (s.count("/"), s.lower()))
    tail.sort(key=lambda s: (s.count("/"), s.lower()))
    return head + tail


# --------------------------------------------------------------------------- #
# Gemini client                                                                 #
# --------------------------------------------------------------------------- #


_SYSTEM_PROMPT = (
    "You are a senior engineer reviewing a software project for a technical "
    "stakeholder. You will be given ONE of:\n"
    "  • A GitHub repository's README plus its top-level file tree, OR\n"
    "  • A raw README / plan / spec document pasted by the user.\n\n"
    "Produce a clear, well-structured **project report** in GitHub-flavored "
    "Markdown. Use this exact top-level structure (do not rename the headings):\n\n"
    "# Project Report\n\n"
    "## 1. Summary\n"
    "2–4 sentences. What the project does and who it is for.\n\n"
    "## 2. Tech Stack\n"
    "Bulleted list of languages, frameworks, major libraries, and infra. "
    "Call out anything inferred vs. explicitly stated.\n\n"
    "## 3. Architecture Overview\n"
    "Describe the main components and how they interact. Reference concrete "
    "files/paths from the tree when possible.\n\n"
    "## 4. Key Features\n"
    "Bullet list of the most important user-facing or technical features.\n\n"
    "## 5. Strengths\n"
    "Bullet list. What this project does well (structure, choices, docs, etc.).\n\n"
    "## 6. Risks & Gaps\n"
    "Bullet list of concrete risks: missing tests, unclear scope, security "
    "concerns, dead code, tech debt, vendor lock-in, etc.\n\n"
    "## 7. Suggested Next Steps\n"
    "Numbered, prioritized, actionable list (5–8 items).\n\n"
    "## 8. Quality Score\n"
    "A single line of the form `Overall: X/10 — one-sentence rationale.` "
    "Base the score on docs, architecture clarity, feature completeness, and "
    "risk level.\n\n"
    "Rules:\n"
    " - Only use information that is actually in the provided context. If "
    "something is unknown, say so explicitly instead of guessing.\n"
    " - Be specific. Reference file paths and framework names where relevant.\n"
    " - Keep the total output under ~900 words. No preamble, no closing "
    "remarks outside the sections above."
)


def _build_user_prompt(ctx: _FetchedContext, pasted_text: str | None) -> str:
    parts: list[str] = []
    if ctx.owner and ctx.repo:
        parts.append(f"Source: GitHub repository `{ctx.owner}/{ctx.repo}` (branch `{ctx.branch}`).")
    elif pasted_text:
        parts.append("Source: user-pasted project document (no repository URL).")
    else:
        parts.append(f"Source: {ctx.label}")

    if ctx.readme.strip():
        parts.append("=== README (verbatim, possibly truncated) ===")
        parts.append(ctx.readme.strip())
    elif pasted_text and pasted_text.strip():
        parts.append("=== Pasted document (verbatim, possibly truncated) ===")
        parts.append(_truncate(pasted_text.strip(), _MAX_PASTED_TEXT))
    else:
        parts.append(
            "=== README ===\n(No README was found or provided. Base the report on the "
            "file tree and label the summary explicitly as inferred.)"
        )

    if ctx.file_list:
        parts.append("=== Top-level file tree (up to 120 entries) ===")
        parts.append("\n".join(ctx.file_list))

    parts.append(
        "Now write the report using the exact section headings described in "
        "the system prompt. Markdown only — no code fences around the whole "
        "response."
    )
    return "\n\n".join(parts)


class _GeminiTransientError(Exception):
    """Retryable Gemini failure (429, 5xx, empty body)."""

    def __init__(self, message: str, status_code: int = 0) -> None:
        super().__init__(message)
        self.status_code = status_code


async def _call_gemini_once(model: str, user_prompt: str) -> str:
    url = _GEMINI_URL_TEMPLATE.format(model=model, key=_GEMINI_KEY)
    body = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "topP": 0.9,
            "maxOutputTokens": 2048,
        },
    }

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT * 2) as client:
        try:
            resp = await client.post(url, json=body)
        except httpx.HTTPError as e:
            raise _GeminiTransientError(f"network error: {e}") from e

    if resp.status_code == 401 or resp.status_code == 403:
        raise HTTPException(
            status_code=503,
            detail="Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env.",
        )
    if resp.status_code == 429 or resp.status_code >= 500:
        snippet = (resp.text or "")[:200]
        raise _GeminiTransientError(
            f"{model} returned {resp.status_code}: {snippet}",
            status_code=resp.status_code,
        )
    if resp.status_code >= 400:
        snippet = resp.text[:300] if resp.text else ""
        raise HTTPException(
            status_code=502,
            detail=f"Gemini ({model}) returned {resp.status_code}: {snippet}",
        )

    try:
        payload = resp.json()
    except ValueError as e:
        raise HTTPException(
            status_code=502, detail=f"Gemini returned invalid JSON: {e}"
        ) from e

    try:
        candidate = payload["candidates"][0]
        parts = candidate["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
    except (KeyError, IndexError, TypeError) as e:
        block_reason = (
            payload.get("promptFeedback", {}).get("blockReason")
            if isinstance(payload, dict)
            else None
        )
        if block_reason:
            raise HTTPException(
                status_code=422,
                detail=f"Gemini blocked the request ({block_reason}).",
            ) from e
        raise _GeminiTransientError("empty candidate list") from e

    if not text:
        raise _GeminiTransientError("empty candidate text")
    return text


async def _call_gemini(user_prompt: str) -> tuple[str, str]:
    """Return (markdown, model_used). Tries primary then fallback on 429/5xx."""
    if not _GEMINI_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Analyzer is disabled: set GEMINI_API_KEY in backend/.env to enable it."
            ),
        )

    models: list[str] = []
    for m in (_GEMINI_MODEL, _GEMINI_MODEL_FALLBACK):
        if m and m not in models:
            models.append(m)

    last_err: str = ""
    for model in models:
        try:
            text = await _call_gemini_once(model, user_prompt)
            return text, model
        except _GeminiTransientError as e:
            logfire.warn("analyzer_gemini_transient", model=model, error=str(e))
            last_err = f"{model}: {e}"
            continue

    raise HTTPException(
        status_code=429,
        detail=(
            "All Gemini models returned transient errors (likely free-tier rate "
            f"limit). Last error: {last_err or 'unknown'}"
        ),
    )


# --------------------------------------------------------------------------- #
# Route                                                                         #
# --------------------------------------------------------------------------- #


@router.post("", response_model=AnalyzeResponse)
async def analyze(body: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze a public repo URL or pasted README/plan text and return a report."""

    repo_url = (body.repo_url or "").strip()
    pasted = (body.text or "").strip()

    if not repo_url and not pasted:
        raise HTTPException(
            status_code=422,
            detail="Provide either a public repo URL or paste README/plan text.",
        )

    # Build the fetch context.
    ctx: _FetchedContext
    if repo_url:
        gh = _parse_github(repo_url)
        if gh is not None:
            with logfire.span(
                "analyzer_fetch_github", owner=gh[0], repo=gh[1]
            ):
                ctx = await _fetch_github(*gh)
        else:
            # Non-GitHub URL — we don't crawl arbitrary sites. If the user also
            # pasted text, use that. Otherwise tell them to paste the README.
            if not pasted:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Only public GitHub URLs are auto-crawled. For GitLab / "
                        "Bitbucket / private repos, paste the README or plan text "
                        "in the text box instead."
                    ),
                )
            ctx = _FetchedContext(
                label=repo_url,
                readme=_truncate(pasted, _MAX_README_CHARS),
                file_list=[],
                owner=None,
                repo=None,
                branch=None,
            )
    else:
        ctx = _FetchedContext(
            label="pasted-document",
            readme=_truncate(pasted, _MAX_README_CHARS),
            file_list=[],
            owner=None,
            repo=None,
            branch=None,
        )

    user_prompt = _build_user_prompt(ctx, pasted if not ctx.readme else None)

    with logfire.span(
        "analyzer_gemini_call",
        model=_GEMINI_MODEL,
        fallback=_GEMINI_MODEL_FALLBACK,
        kind=ctx.kind,
        readme_chars=len(ctx.readme),
        file_count=len(ctx.file_list),
    ):
        markdown, model_used = await _call_gemini(user_prompt)

    source = AnalyzeSource(
        kind=ctx.kind,
        label=ctx.label,
        repo_owner=ctx.owner,
        repo_name=ctx.repo,
        default_branch=ctx.branch,
        files_sampled=len(ctx.file_list),
        readme_chars=len(ctx.readme),
    )
    return AnalyzeResponse(
        report_markdown=markdown.strip(),
        source=source,
        model=model_used,
    )
