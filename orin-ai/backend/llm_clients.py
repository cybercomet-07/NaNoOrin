"""
Orin AI — Shared LLM Client  (GAP-2 / G2.1)
────────────────────────────────────────────
Single entry-point for every LLM call in the pipeline.
Agents MUST use call_agent_llm() — never instantiate Groq clients directly.

Quota-aware routing:
  - Every agent has a **preferred** key (same mapping as before, still useful
    because different agents hit different TPM patterns).
  - On a *daily* (TPD) rate-limit error, we transparently fail the request over
    to the next available key in the pool. Keys marked TPD-exhausted for the day
    are skipped until ORIN_GROQ_TPD_COOLDOWN_SEC (default 3600s) elapses.
  - If **all** 70B keys are TPD-exhausted, the client auto-falls back to the
    ``llama-3.1-8b-instant`` model (much larger daily quota). Callers don't
    need to know this happened — the result is still a completion.
  - If **all** Groq capacity (across both model tiers and every key) is
    unavailable, the client falls back to DeepSeek via its OpenAI-compatible
    endpoint, using ``DEEPSEEK_API_KEY_1/2``.
  - Per-minute (TPM) 429 errors trigger a short backoff + retry on the same key.

Env knobs (all optional):
  ORIN_GROQ_STRONG_MODEL            default ``llama-3.3-70b-versatile``
  ORIN_GROQ_FAST_MODEL              default ``llama-3.1-8b-instant``
  ORIN_GROQ_TPD_COOLDOWN_SEC        default 3600
  ORIN_GROQ_ALLOW_FALLBACK_MODEL    default "1" (set "0" to disable 70B→8B fallback)
  ORIN_GROQ_BACKOFF_CAP_SEC         default 8
"""

from __future__ import annotations

import logging
import os
import random
import time
from functools import lru_cache

from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI  # used for DeepSeek (OpenAI-compatible API)

load_dotenv()

log = logging.getLogger(__name__)

MAX_HISTORY_TURNS = 6

# Groq model IDs (public API names)
GROQ_LLAMA_70B = os.getenv("ORIN_GROQ_STRONG_MODEL", "llama-3.3-70b-versatile")
GROQ_LLAMA_8B_INSTANT = os.getenv("ORIN_GROQ_FAST_MODEL", "llama-3.1-8b-instant")

# Legacy aliases (other modules still import these names)
GEMINI_FLASH = GROQ_LLAMA_70B
GEMINI_FLASH_LITE = GROQ_LLAMA_8B_INSTANT


def truncate_messages(
    messages: list[dict],
    max_turns: int = MAX_HISTORY_TURNS,
    content_max_chars: int | None = None,
) -> list[dict]:
    convo = [m for m in messages if m.get("role") in ("user", "assistant")]
    sliced = convo[-(max_turns * 2) :]
    if content_max_chars is None:
        return sliced
    out: list[dict] = []
    for m in sliced:
        mc = dict(m)
        c = mc.get("content", "")
        if isinstance(c, str) and len(c) > content_max_chars:
            mc["content"] = c[:content_max_chars] + "\n…[truncated]"
        out.append(mc)
    return out


# ── Client pool ───────────────────────────────────────────────────────────────
_POOL_ENV_KEYS = (
    "GROQ_API_KEY_1",
    "GROQ_API_KEY_2",
    "GROQ_API_KEY_3",
    "GROQ_API_KEY_4",
    "GROQ_API_KEY_5",
)

# DeepSeek fallback pool. Used only when every Groq key is TPD-exhausted or invalid.
# DeepSeek exposes an OpenAI-compatible endpoint (base_url=https://api.deepseek.com).
_DEEPSEEK_ENV_KEYS = ("DEEPSEEK_API_KEY_1", "DEEPSEEK_API_KEY_2")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

# OpenRouter routing for specific agents (Developer, Architect). These two agents
# produce the project code + architecture, which is what the judges actually see.
# Free Groq buckets are unreliable for code generation; OpenRouter with DeepSeek v3.1
# is rock-solid within the free-tier credits on each OpenRouter account. Each agent
# uses its OWN key so their quotas don't interfere with each other.
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_AGENT_MODEL = os.getenv("OPENROUTER_AGENT_MODEL", "deepseek/deepseek-chat-v3.1")
OPENROUTER_AGENT_MODEL_FALLBACK = os.getenv(
    "OPENROUTER_AGENT_MODEL_FALLBACK", "openai/gpt-oss-120b:free"
)

# Per-agent OpenRouter keys. Critic / Auditor / ReadMe-generator now route to
# the OpenRouter account that used to power the Developer (sk-or-v1-3fdae4…).
# Developer itself has moved to OpenAI paid (below); if OPENAI_API_KEY is blank
# Developer falls back through OpenRouter as before.
_AGENT_OPENROUTER_ENV_KEY: dict[str, str] = {
    "developer": "OPENROUTER_DEVELOPER_KEY",
    "architect": "OPENROUTER_ARCHITECT_KEY",
    "critic": "OPENROUTER_CRITIC_KEY",
    "auditor": "OPENROUTER_AUDITOR_KEY",
    "readme_generator": "OPENROUTER_README_KEY",
}

# OpenAI direct-API routing. Only the Developer agent uses it today.
# Leave OPENAI_API_KEY unset to skip OpenAI and use OpenRouter instead.
OPENAI_API_KEY_ENV = "OPENAI_API_KEY"
_AGENT_OPENAI_MODEL: dict[str, str] = {
    "developer": os.getenv("OPENAI_DEVELOPER_MODEL", "gpt-4o-mini"),
}

# Per-agent *preferred* key (first to try). Fallback walks the rest of the pool.
# Spread across 5 keys so concurrent agents don't stack on the same quota bucket.
_AGENT_PREFERRED_KEY: dict[str, str] = {
    "supervisor": "GROQ_API_KEY_1",
    "researcher": "GROQ_API_KEY_2",
    "architect": "GROQ_API_KEY_3",
    "developer": "GROQ_API_KEY_4",
    "critic": "GROQ_API_KEY_5",
    "persona": "GROQ_API_KEY_1",
    "auditor": "GROQ_API_KEY_2",
    # README generator: lowest-priority key so it doesn't contend with live agents.
    "readme_generator": "GROQ_API_KEY_3",
}

VALID_AGENT_NAMES = frozenset(_AGENT_PREFERRED_KEY.keys())

AGENT_MODELS = {
    # DEMO MODE: Groq free tier shares a single org-wide daily quota per model.
    # The 70B daily bucket is tiny (~100k tokens shared across all keys); the
    # 8B-instant bucket is ~500k/day and more than enough for small demo prompts.
    # Every agent uses 8B so a live demo never hits the TPD wall. Override via
    # ORIN_GROQ_STRONG_MODEL / ORIN_GROQ_FAST_MODEL if you want the 70B back.
    "supervisor": GROQ_LLAMA_8B_INSTANT,
    "researcher": GROQ_LLAMA_8B_INSTANT,
    "architect": GROQ_LLAMA_8B_INSTANT,
    "developer": GROQ_LLAMA_8B_INSTANT,
    "critic": GROQ_LLAMA_8B_INSTANT,
    "persona": GROQ_LLAMA_8B_INSTANT,
    "auditor": GROQ_LLAMA_8B_INSTANT,
    "readme_generator": GROQ_LLAMA_8B_INSTANT,
}

# Daily-exhausted key registry: {env_key: unix_ts_when_usable_again}
_tpd_exhausted: dict[str, float] = {}
# Keys the API server has rejected as invalid (401). Sticky for this process lifetime —
# a revoked/rotated key will not self-heal.
_invalid_keys: set[str] = set()
_TPD_COOLDOWN_SEC = float(os.getenv("ORIN_GROQ_TPD_COOLDOWN_SEC", "3600"))
_ALLOW_MODEL_FALLBACK = os.getenv("ORIN_GROQ_ALLOW_FALLBACK_MODEL", "1").strip() not in ("0", "false", "no")


def _is_auth_error(msg: str) -> bool:
    m = msg.lower()
    return (
        "401" in m
        or "invalid api key" in m
        or "invalid_api_key" in m
        or "unauthorized" in m
        # 402 = DeepSeek "Insufficient Balance". Treat like auth so we stop retrying.
        or "402" in m
        or "insufficient balance" in m
    )


@lru_cache(maxsize=16)
def _groq_client_for_env_key(env_key: str) -> Groq:
    """Lazy client — import succeeds without all keys; first use raises if key missing."""
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return Groq(api_key=api_key)


@lru_cache(maxsize=8)
def _deepseek_client_for_env_key(env_key: str) -> OpenAI:
    """Lazy DeepSeek client (OpenAI-compatible). Raises only on first use if key missing."""
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)


@lru_cache(maxsize=8)
def _openrouter_client_for_env_key(env_key: str) -> OpenAI:
    """Lazy OpenRouter client. OpenRouter is OpenAI-compatible."""
    api_key = os.getenv(env_key)
    if not api_key:
        raise ValueError(f"Missing environment variable: {env_key}")
    return OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)


@lru_cache(maxsize=2)
def _openai_client() -> OpenAI:
    """Lazy direct-OpenAI client. Only used when OPENAI_API_KEY is set."""
    api_key = os.getenv(OPENAI_API_KEY_ENV)
    if not api_key:
        raise ValueError(f"Missing environment variable: {OPENAI_API_KEY_ENV}")
    return OpenAI(api_key=api_key)


def _attempt_openai_call(
    model: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
    max_tpm_retries: int = 2,
) -> str:
    """Direct OpenAI attempt with a small TPM backoff. Raises on auth/429-TPD."""
    client = _openai_client()
    last_exc: Exception | None = None
    for attempt in range(max_tpm_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,  # type: ignore[arg-type]
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            last_exc = e
            msg = str(e)
            if _is_auth_error(msg):
                log.error("[AUTH-FAIL] OPENAI_API_KEY rejected (401/402)")
                _invalid_keys.add(OPENAI_API_KEY_ENV)
                raise
            kind = _classify_rate_limit(msg)
            if kind == "tpd":
                _mark_tpd_exhausted(OPENAI_API_KEY_ENV)
                raise
            if kind == "tpm":
                wait = (2**attempt) + random.uniform(0, 1)
                log.warning(
                    "[TPM] openai (%s): attempt %d/%d — sleeping %.1fs",
                    model,
                    attempt + 1,
                    max_tpm_retries,
                    wait,
                )
                _backoff_sleep(wait)
                continue
            raise
    assert last_exc is not None
    raise last_exc


def _try_openai_for_agent(
    agent_name: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> str | None:
    """If the agent is OpenAI-routed and the key is present+valid, try it.
    Returns None to signal 'fall through to OpenRouter/Groq'."""
    model = _AGENT_OPENAI_MODEL.get(agent_name)
    if not model:
        return None
    if not os.getenv(OPENAI_API_KEY_ENV):
        return None
    if OPENAI_API_KEY_ENV in _invalid_keys:
        return None
    if _is_tpd_exhausted(OPENAI_API_KEY_ENV):
        return None
    try:
        return _attempt_openai_call(model, api_messages, max_tokens, temperature)
    except Exception as e:
        msg = str(e)
        if _is_auth_error(msg):
            return None
        kind = _classify_rate_limit(msg)
        if kind in ("tpm", "tpd"):
            log.warning(
                "[OPENAI-LIMIT] agent=%s: %s — falling through to OpenRouter",
                agent_name,
                kind,
            )
            return None
        log.warning(
            "[OPENAI-FAIL] agent=%s model=%s: %s — falling through to OpenRouter",
            agent_name,
            model,
            str(e)[:200],
        )
        return None


def _attempt_openrouter_call(
    env_key: str,
    model: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
    max_tpm_retries: int = 2,
) -> str:
    """One OpenRouter (key, model) attempt with a small TPM backoff."""
    client = _openrouter_client_for_env_key(env_key)
    last_exc: Exception | None = None
    for attempt in range(max_tpm_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,  # type: ignore[arg-type]
                max_tokens=max_tokens,
                temperature=temperature,
                extra_headers={
                    "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "http://localhost:3000"),
                    "X-Title": "Orin AI",
                },
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            last_exc = e
            msg = str(e)
            if _is_auth_error(msg):
                if env_key not in _invalid_keys:
                    log.error(
                        "[AUTH-FAIL] %s rejected as invalid OpenRouter key", env_key
                    )
                _invalid_keys.add(env_key)
                raise
            kind = _classify_rate_limit(msg)
            if kind == "tpd":
                _mark_tpd_exhausted(env_key)
                raise
            if kind == "tpm":
                wait = (2**attempt) + random.uniform(0, 1)
                log.warning(
                    "[TPM] %s (openrouter %s): attempt %d/%d — sleeping %.1fs",
                    env_key,
                    model,
                    attempt + 1,
                    max_tpm_retries,
                    wait,
                )
                _backoff_sleep(wait)
                continue
            raise
    assert last_exc is not None
    raise last_exc


def _try_openrouter_for_agent(
    agent_name: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> str | None:
    """If this agent is configured for OpenRouter and the key is present + valid,
    try primary model then fallback model. Returns None to signal 'fall through to Groq'."""
    env_key = _AGENT_OPENROUTER_ENV_KEY.get(agent_name)
    if not env_key or not os.getenv(env_key) or env_key in _invalid_keys:
        return None
    for model in (OPENROUTER_AGENT_MODEL, OPENROUTER_AGENT_MODEL_FALLBACK):
        if not model:
            continue
        try:
            result = _attempt_openrouter_call(
                env_key, model, api_messages, max_tokens, temperature
            )
            if model != OPENROUTER_AGENT_MODEL:
                log.info(
                    "[OPENROUTER-FALLBACK-MODEL] agent=%s served by %s", agent_name, model
                )
            return result
        except Exception as e:
            msg = str(e)
            if _is_auth_error(msg):
                log.warning(
                    "[OPENROUTER-AUTH] agent=%s key=%s rejected; falling through to Groq",
                    agent_name,
                    env_key,
                )
                return None
            log.warning(
                "[OPENROUTER-FAIL] agent=%s model=%s: %s — trying next model/tier",
                agent_name,
                model,
                str(e)[:200],
            )
            continue
    return None


def _attempt_deepseek_call(
    env_key: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
    max_tpm_retries: int = 2,
) -> str:
    """One DeepSeek (key, deepseek-chat) attempt with a small TPM backoff."""
    client = _deepseek_client_for_env_key(env_key)
    last_exc: Exception | None = None
    for attempt in range(max_tpm_retries):
        try:
            response = client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=api_messages,  # type: ignore[arg-type]
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            last_exc = e
            msg = str(e)
            if _is_auth_error(msg):
                if env_key not in _invalid_keys:
                    log.error("[AUTH-FAIL] %s rejected as invalid DeepSeek key (401)", env_key)
                _invalid_keys.add(env_key)
                raise
            kind = _classify_rate_limit(msg)
            if kind == "tpd":
                _mark_tpd_exhausted(env_key)
                raise
            if kind == "tpm":
                wait = (2**attempt) + random.uniform(0, 1)
                log.warning(
                    "[TPM] %s (deepseek): attempt %d/%d — sleeping %.1fs",
                    env_key,
                    attempt + 1,
                    max_tpm_retries,
                    wait,
                )
                _backoff_sleep(wait)
                continue
            raise
    assert last_exc is not None
    raise last_exc


def _is_tpd_exhausted(env_key: str) -> bool:
    ts = _tpd_exhausted.get(env_key)
    if ts is None:
        return False
    if time.time() >= ts:
        _tpd_exhausted.pop(env_key, None)
        return False
    return True


def _mark_tpd_exhausted(env_key: str) -> None:
    until = time.time() + _TPD_COOLDOWN_SEC
    _tpd_exhausted[env_key] = until
    log.warning(
        "[TPD-EXHAUSTED] %s daily quota hit; skipping for %.0fs",
        env_key,
        _TPD_COOLDOWN_SEC,
    )


def _available_key_order(preferred: str) -> list[str]:
    """Preferred first, then the rest of the pool, excluding daily-exhausted or known-invalid keys."""
    order = [preferred] + [k for k in _POOL_ENV_KEYS if k != preferred]
    return [
        k
        for k in order
        if os.getenv(k) and not _is_tpd_exhausted(k) and k not in _invalid_keys
    ]


def _classify_rate_limit(msg: str) -> str | None:
    """Returns 'tpd' (daily), 'tpm' (per-minute), or None if not a rate limit.

    Groq errors include strings like:
      "Rate limit reached for model ... on tokens per minute (TPM): Limit 6000"
      "Rate limit reached for model ... on tokens per day (TPD): Limit 100000"
    Only flag TPD on explicit per-day phrasing — NEVER match on the Limit
    number itself because "Limit 100000" also appears in some TPM messages.
    """
    m = msg.lower()
    if "429" not in m and "rate limit" not in m and "quota" not in m and "too many requests" not in m:
        return None
    if "per day" in m or "tokens per day" in m or "tpd" in m:
        return "tpd"
    if "per minute" in m or "tokens per minute" in m or "tpm" in m:
        return "tpm"
    # Ambiguous — prefer TPM because it's recoverable by key rotation.
    return "tpm"


# ── Retry / backoff (TPM only) ────────────────────────────────────────────────
def _backoff_sleep(seconds: float) -> None:
    cap = float(os.getenv("ORIN_GROQ_BACKOFF_CAP_SEC", "8"))
    secs = min(seconds, cap)
    try:
        import asyncio

        asyncio.get_running_loop()
    except RuntimeError:
        time.sleep(secs)
        return
    loop_cap = float(os.getenv("ORIN_GROQ_LOOP_THREAD_SLEEP_CAP_SEC", "0.25"))
    time.sleep(min(secs, loop_cap))


def _attempt_call(
    env_key: str,
    model: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
    max_tpm_retries: int = 1,
) -> str:
    """Try one (key, model) pair. Retries TPM up to N times; raises on TPD or other errors."""
    client = _groq_client_for_env_key(env_key)
    last_exc: Exception | None = None
    for attempt in range(max_tpm_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=api_messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_exc = e
            msg = str(e)
            if _is_auth_error(msg):
                if env_key not in _invalid_keys:
                    log.error("[AUTH-FAIL] %s rejected as invalid API key (401)", env_key)
                _invalid_keys.add(env_key)
                raise
            kind = _classify_rate_limit(msg)
            if kind == "tpd":
                _mark_tpd_exhausted(env_key)
                raise
            if kind == "tpm":
                wait = (2**attempt) + random.uniform(0, 1)
                log.warning(
                    "[TPM] %s: attempt %d/%d — sleeping %.1fs",
                    env_key,
                    attempt + 1,
                    max_tpm_retries,
                    wait,
                )
                _backoff_sleep(wait)
                continue
            raise
    assert last_exc is not None
    raise last_exc


def _call_with_fallback(
    agent_name: str,
    api_messages: list[dict],
    max_tokens: int,
    temperature: float,
) -> str:
    """Walk the key pool on TPD; optionally fall back to the 8B model as a last resort."""
    # ── PRIMARY (for OpenAI-routed agents): direct OpenAI ─────────────────────
    # Developer uses OpenAI paid (gpt-4o-mini by default). Best quality for the
    # actual project code the judges see. Falls through on auth/limit issues.
    if agent_name in _AGENT_OPENAI_MODEL:
        result = _try_openai_for_agent(
            agent_name, api_messages, max_tokens, temperature
        )
        if result is not None:
            return result
        log.info(
            "[OPENAI-FALLTHROUGH] agent=%s falling back to OpenRouter/Groq",
            agent_name,
        )

    # ── SECONDARY: OpenRouter for configured agents ──────────────────────────
    # Architect / Critic / Auditor / ReadMe / (Developer if OpenAI is absent)
    # go through OpenRouter + DeepSeek here. Groq-only agents skip this block.
    if agent_name in _AGENT_OPENROUTER_ENV_KEY:
        result = _try_openrouter_for_agent(
            agent_name, api_messages, max_tokens, temperature
        )
        if result is not None:
            return result
        log.warning(
            "[OPENROUTER-FALLTHROUGH] agent=%s falling back to Groq pool", agent_name
        )

    preferred = _AGENT_PREFERRED_KEY[agent_name]
    model = AGENT_MODELS[agent_name]

    last_err: Exception | None = None
    keys = _available_key_order(preferred)
    if not keys:
        # Nothing left today. Clear oldest entry so we at least attempt something.
        log.warning("All Groq keys TPD-exhausted; forcing preferred key %s as last resort.", preferred)
        keys = [preferred]

    for env_key in keys:
        try:
            result = _attempt_call(env_key, model, api_messages, max_tokens, temperature)
            if env_key != preferred:
                log.info("[FAILOVER] agent=%s served by %s (preferred %s exhausted)", agent_name, env_key, preferred)
            return result
        except Exception as e:
            last_err = e
            msg = str(e)
            if _is_auth_error(msg):
                # Invalid key → keep walking to the next one in the pool.
                log.warning(
                    "[AUTH-FAILOVER] agent=%s: %s invalid; trying next key in pool",
                    agent_name,
                    env_key,
                )
                continue
            kind = _classify_rate_limit(msg)
            if kind == "tpd":
                # Already marked; keep walking to the next key.
                continue
            if kind == "tpm":
                # Current key's per-minute bucket is full. Try the next key
                # (its TPM bucket is independent) instead of failing.
                log.warning(
                    "[TPM-FAILOVER] agent=%s: %s at per-minute limit; trying next key",
                    agent_name,
                    env_key,
                )
                continue
            # Non-rate-limit, non-auth error: bubble up immediately.
            raise

    # Every 70B key is TPD-exhausted. Fall back to 8B instant model (much higher daily quota).
    if _ALLOW_MODEL_FALLBACK and model != GROQ_LLAMA_8B_INSTANT:
        fallback_keys = [
            k for k in _POOL_ENV_KEYS if os.getenv(k) and k not in _invalid_keys
        ]
        for env_key in fallback_keys:
            try:
                log.warning(
                    "[MODEL-FALLBACK] agent=%s: all 70B keys out of daily quota → retrying on %s @ %s",
                    agent_name,
                    env_key,
                    GROQ_LLAMA_8B_INSTANT,
                )
                return _attempt_call(
                    env_key,
                    GROQ_LLAMA_8B_INSTANT,
                    api_messages,
                    max_tokens,
                    temperature,
                )
            except Exception as e:
                last_err = e
                continue

    # Last-resort provider fallback #1: OpenRouter. Walk every OpenRouter key
    # we know about — developer/architect are on separate accounts, and the
    # shared "fallback" key is a fresh account that still has credit even if
    # everything else is dry. De-duplicate so we don't hit the same account
    # twice (critic/auditor/readme intentionally point at the developer key).
    _seen_values: set[str] = set()
    _openrouter_fallback_order: list[str] = []
    for env_key in (
        "OPENROUTER_DEVELOPER_KEY",
        "OPENROUTER_ARCHITECT_KEY",
        "OPENROUTER_CRITIC_KEY",
        "OPENROUTER_AUDITOR_KEY",
        "OPENROUTER_README_KEY",
        "OPENROUTER_FALLBACK_KEY",
    ):
        val = os.getenv(env_key)
        if not val or val in _seen_values:
            continue
        _seen_values.add(val)
        _openrouter_fallback_order.append(env_key)
    for env_key in _openrouter_fallback_order:
        if not os.getenv(env_key) or env_key in _invalid_keys:
            continue
        for model in (OPENROUTER_AGENT_MODEL, OPENROUTER_AGENT_MODEL_FALLBACK):
            if not model:
                continue
            try:
                log.warning(
                    "[PROVIDER-FALLBACK] agent=%s: all Groq capacity unavailable → OpenRouter %s via %s",
                    agent_name,
                    model,
                    env_key,
                )
                return _attempt_openrouter_call(
                    env_key, model, api_messages, max_tokens, temperature
                )
            except Exception as e:
                last_err = e
                continue

    # Last-resort provider fallback #2: DeepSeek direct. Only used if the user still
    # has a DeepSeek direct-API account with credit (optional).
    deepseek_keys = [
        k for k in _DEEPSEEK_ENV_KEYS
        if os.getenv(k) and not _is_tpd_exhausted(k) and k not in _invalid_keys
    ]
    for env_key in deepseek_keys:
        try:
            log.warning(
                "[PROVIDER-FALLBACK] agent=%s: all Groq capacity unavailable → DeepSeek via %s",
                agent_name,
                env_key,
            )
            return _attempt_deepseek_call(
                env_key,
                api_messages,
                max_tokens,
                temperature,
            )
        except Exception as e:
            last_err = e
            continue

    assert last_err is not None
    raise RuntimeError(
        f"Rate limit not resolved for agent '{agent_name}': all keys exhausted. "
        f"Original error: {last_err}"
    ) from last_err


# ── Public entry point ────────────────────────────────────────────────────────
def call_agent_llm(
    agent_name: str,
    system_prompt: str,
    user_message: str,
    messages_history: list[dict] | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
    *,
    max_history_turns: int | None = None,
    max_history_content_chars: int | None = None,
) -> str:
    if agent_name not in VALID_AGENT_NAMES:
        raise ValueError(
            f"Unknown agent: '{agent_name}'. Valid agents: {sorted(VALID_AGENT_NAMES)}"
        )

    turns = max_history_turns if max_history_turns is not None else MAX_HISTORY_TURNS
    history = truncate_messages(
        messages_history or [],
        max_turns=turns,
        content_max_chars=max_history_content_chars,
    )
    api_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    api_messages.extend(history)
    api_messages.append({"role": "user", "content": user_message})

    return _call_with_fallback(
        agent_name=agent_name,
        api_messages=api_messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def validate_all_keys() -> dict:
    required = [
        "GROQ_API_KEY_1",
        "GROQ_API_KEY_2",
        "GROQ_API_KEY_3",
        "GROQ_API_KEY_4",
        "GROQ_API_KEY_5",
        "TAVILY_API_KEY",
        "E2B_API_KEY",
        "LOGFIRE_TOKEN",
    ]
    optional_deepseek = ["DEEPSEEK_API_KEY_1", "DEEPSEEK_API_KEY_2"]
    optional_openrouter = [
        "OPENROUTER_DEVELOPER_KEY",
        "OPENROUTER_ARCHITECT_KEY",
        "OPENROUTER_CRITIC_KEY",
        "OPENROUTER_AUDITOR_KEY",
        "OPENROUTER_README_KEY",
        "OPENROUTER_FALLBACK_KEY",
    ]
    optional_openai = ["OPENAI_API_KEY"]

    results = {key: ("ok" if os.getenv(key) else "MISSING") for key in required}
    for key in optional_deepseek + optional_openrouter + optional_openai:
        results[key] = "ok" if os.getenv(key) else "OPTIONAL-MISSING"

    missing = [k for k, v in results.items() if v == "MISSING"]
    if missing:
        print(f"[WARNING] Missing env vars: {missing}")
    else:
        print("[OK] All required environment variables present")

    print(
        f"[INFO] DeepSeek direct keys: {sum(1 for k in optional_deepseek if results[k] == 'ok')}/{len(optional_deepseek)}"
    )

    # De-dupe OpenRouter keys by VALUE so we report the real number of distinct
    # accounts, not just the number of env slots that are set.
    _seen_vals: set[str] = set()
    _distinct = 0
    for k in optional_openrouter:
        v = os.getenv(k)
        if v and v not in _seen_vals:
            _seen_vals.add(v)
            _distinct += 1
    print(
        f"[INFO] OpenRouter accounts configured: {_distinct} "
        f"(across {sum(1 for k in optional_openrouter if results[k] == 'ok')} slots)"
    )

    if results["OPENAI_API_KEY"] == "ok":
        print(
            f"[OK] OpenAI direct API configured (Developer -> "
            f"{os.getenv('OPENAI_DEVELOPER_MODEL', 'gpt-4o-mini')})"
        )
    else:
        print(
            "[INFO] OPENAI_API_KEY not set - Developer will use OpenRouter/DeepSeek instead."
        )
    return results
