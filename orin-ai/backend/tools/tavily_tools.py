"""Tavily search helpers for the Researcher and Developer agents."""

from __future__ import annotations

import os
import re
import time
from typing import Any

from dotenv import load_dotenv
from tavily import TavilyClient

load_dotenv()

_TAVILY_FALLBACK: dict[str, Any] = {
    "competitors": [],
    "pain_points": [],
    "market_context": "Search unavailable — proceeding with general knowledge",
}

_RETRY_DELAYS_SEC = (2, 4, 8)


def _goal_to_domain(goal: str) -> str:
    """Derive a concise product/domain phrase from the user's goal."""
    g = " ".join(goal.split())
    if not g:
        return "product"
    return g[:220] if len(g) > 220 else g


def _pricing_hint_from_text(text: str) -> str:
    if not text:
        return ""
    lower = text.lower()
    if any(x in lower for x in ("$", "€", "£", "pricing", "price", "free tier", "subscription")):
        snippet = text.replace("\n", " ").strip()
        return snippet[:240] + ("…" if len(snippet) > 240 else "")
    return ""


def _result_row_to_competitor(row: dict[str, Any]) -> dict[str, str]:
    title = str(row.get("title") or "Unknown")
    url = str(row.get("url") or "")
    content = str(row.get("content") or row.get("raw_content") or "")
    return {
        "name": title[:120],
        "url": url,
        "description": content[:800],
        "pricing_hint": _pricing_hint_from_text(content),
    }


def _collect_pain_points(rows: list[dict[str, Any]], limit: int = 12) -> list[str]:
    out: list[str] = []
    for row in rows:
        text = str(row.get("content") or row.get("raw_content") or "").strip()
        if not text:
            continue
        sentences = re.split(r"(?<=[.!?])\s+", text)
        for s in sentences:
            s = s.strip()
            if len(s) < 20:
                continue
            if any(
                w in s.lower()
                for w in (
                    "pain",
                    "frustrat",
                    "issue",
                    "problem",
                    "wish",
                    "difficult",
                    "slow",
                    "expensive",
                    "missing",
                )
            ):
                out.append(s[:400])
            if len(out) >= limit:
                return out
        if len(out) < limit and text:
            out.append(text[:400])
        if len(out) >= limit:
            break
    return out[:limit]


def _search_with_retry(client: TavilyClient, query: str) -> dict[str, Any]:
    """Exponential backoff: 2s, 4s, 8s between attempts; max 3 tries (plan: Tavily errors)."""
    last: BaseException | None = None
    for attempt in range(3):
        try:
            return client.search(
                query,
                max_results=5,
                search_depth="advanced",
                include_answer=True,
                include_raw_content="text",
            )
        except Exception as exc:
            last = exc
            print(f"[tavily_tools] search attempt {attempt + 1}/3 failed: {exc!r}")
            if attempt < 2:
                time.sleep(_RETRY_DELAYS_SEC[attempt])
    assert last is not None
    raise last


def search_competitors(goal: str) -> dict[str, Any]:
    """
    Run three Tavily searches (competitors, pain points, market) and aggregate results.
    On total failure, returns a safe empty structure so the pipeline never hard-fails.
    """
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        print("[tavily_tools] TAVILY_API_KEY missing; using fallback aggregation.")
        return dict(_TAVILY_FALLBACK)

    domain = _goal_to_domain(goal)
    queries = (
        f"top competitors {domain} 2024 features pricing",
        f"{domain} user complaints pain points reddit",
        f"{domain} market size funding 2024",
    )

    try:
        client = TavilyClient(api_key=key)
    except Exception as exc:
        print(f"[tavily_tools] could not create TavilyClient: {exc!r}")
        return dict(_TAVILY_FALLBACK)

    raw_responses: list[dict[str, Any]] = []
    for q in queries:
        try:
            raw_responses.append(_search_with_retry(client, q))
        except Exception as exc:
            print(f"[tavily_tools] query failed after retries: {q!r} ({exc!r})")
            raw_responses.append({"results": [], "answer": ""})

    competitors_raw = raw_responses[0].get("results") or []
    pain_raw = raw_responses[1].get("results") or []
    market_raw = raw_responses[2].get("results") or []

    competitors: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in competitors_raw:
        c = _result_row_to_competitor(row if isinstance(row, dict) else {})
        key_url = c["url"] or c["name"]
        if key_url in seen:
            continue
        seen.add(key_url)
        competitors.append(c)

    pain_points = _collect_pain_points([r for r in pain_raw if isinstance(r, dict)])
    if not pain_points:
        pain_points = [
            str(r.get("content") or "")[:400]
            for r in pain_raw
            if isinstance(r, dict) and (r.get("content") or r.get("raw_content"))
        ][:8]

    market_answer = str(raw_responses[2].get("answer") or "").strip()
    market_context = market_answer
    if not market_context and market_raw:
        parts = []
        for r in market_raw[:3]:
            if not isinstance(r, dict):
                continue
            parts.append(str(r.get("content") or "")[:500])
        market_context = "\n\n".join(p for p in parts if p)

    if not market_context:
        market_context = (
            raw_responses[0].get("answer")
            or raw_responses[1].get("answer")
            or "Limited market context from search snippets."
        )
        if isinstance(market_context, str):
            market_context = market_context.strip()
        else:
            market_context = str(market_context)

    return {
        "competitors": competitors,
        "pain_points": pain_points,
        "market_context": market_context[:4000],
    }


def search_technology(query: str) -> list[dict[str, str]]:
    """Single Tavily search for library/technology research; returns title/url/content rows."""
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return []

    try:
        client = TavilyClient(api_key=key)
        data = _search_with_retry(client, query)
    except Exception as exc:
        print(f"[tavily_tools] search_technology failed: {exc!r}")
        return []

    out: list[dict[str, str]] = []
    for row in data.get("results") or []:
        if not isinstance(row, dict):
            continue
        out.append(
            {
                "title": str(row.get("title") or ""),
                "url": str(row.get("url") or ""),
                "content": str(row.get("content") or row.get("raw_content") or ""),
            }
        )
    return out


if __name__ == "__main__":
    print(search_competitors("task management app"))
