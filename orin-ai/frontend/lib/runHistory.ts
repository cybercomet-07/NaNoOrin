/**
 * Run history — localStorage-backed record of past pipeline runs.
 *
 * Kept entirely client-side for now. When a run reaches a terminal state
 * (FINALIZED / FAILED / PANIC), the /run/:id page records an entry here.
 * The History and Report pages read from here.
 *
 * Storage layout:
 *   localStorage["orin.runs.v1"] = JSON-encoded HistoryRun[] (newest first)
 *
 * Schema is versioned in the key ("v1") so we can migrate safely later if we
 * change the shape or move to a backend-backed store.
 */

export type RunStatus = "FINALIZED" | "FAILED" | "PANIC" | "RUNNING"

export interface HistoryRun {
  /** Backend-issued run UUID. */
  runId: string
  /** Short, human-readable title derived from the prompt (or demo name). */
  title: string
  /** The full original prompt the user submitted. */
  prompt: string
  /** Terminal status at the moment the entry was recorded. */
  status: RunStatus
  /** Unix ms at which the run was kicked off (earliest event timestamp). */
  startedAt: number
  /** Unix ms at which the run reached a terminal state. */
  finishedAt: number
  /** Elapsed time in ms (finishedAt - startedAt). */
  elapsedMs: number
  /** Generated files, { filename: contents }. Capped to keep localStorage small. */
  files: Record<string, string>
  /** Short category tag for display ("Website", "Landing", etc.). Derived from prompt. */
  category: string
  /** True if this run took the static-site fast lane (vs full pipeline). */
  staticSite: boolean
}

const STORAGE_KEY = "orin.runs.v1"
/** Soft cap on history size to keep localStorage under ~4-5 MB. */
const MAX_ENTRIES = 40
/** Don't store individual files larger than this (truncate). */
const MAX_FILE_CHARS = 60_000

function safeRead(): HistoryRun[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHistoryRun)
  } catch {
    return []
  }
}

function safeWrite(entries: HistoryRun[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded — drop oldest half and retry once.
    try {
      const half = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(half))
    } catch {
      // Give up silently — history is non-critical.
    }
  }
}

function isHistoryRun(v: unknown): v is HistoryRun {
  if (!v || typeof v !== "object") return false
  const o = v as Record<string, unknown>
  return (
    typeof o.runId === "string" &&
    typeof o.title === "string" &&
    typeof o.prompt === "string" &&
    typeof o.status === "string" &&
    typeof o.startedAt === "number" &&
    typeof o.finishedAt === "number"
  )
}

/**
 * Turn the first meaningful sentence of a prompt into a short title.
 * "A single-page static portfolio website for a developer named Alex Morgan."
 *   → "Alex Morgan Portfolio"
 * Falls back to "Project <short hash>" for unusable prompts.
 */
export function deriveTitle(prompt: string): string {
  const p = prompt.trim()
  if (!p) return "Untitled Project"

  // Common demo-prompt patterns: extract the proper noun + the subject.
  const patterns: Array<{ re: RegExp; fn: (m: RegExpMatchArray) => string }> = [
    { re: /\bcalled\s+['"]?([^'"\.]+?)['"]?\s*[\.,]/i, fn: (m) => m[1].trim() },
    { re: /\bfor\s+(?:a\s+)?(?:developer\s+)?named\s+['"]?([^'"\.]+?)['"]?\s*[\.,]/i, fn: (m) => `${m[1].trim()} Portfolio` },
    { re: /\btitled\s+['"]([^'"]+)['"]/i, fn: (m) => m[1].trim() },
    { re: /\bportfolio\b/i, fn: () => "Developer Portfolio" },
    { re: /\bcountdown\b/i, fn: () => "Event Countdown" },
    { re: /\bquote\s+of\s+the\s+day\b/i, fn: () => "Quote of the Day" },
    { re: /\btodo\s+list\b/i, fn: () => "Todo List" },
    { re: /\bproduct\s+(detail\s+)?card\b/i, fn: () => "Product Card" },
    { re: /\blanding\s+(page|site|website)\b/i, fn: () => "Landing Page" },
  ]
  for (const { re, fn } of patterns) {
    const m = p.match(re)
    if (m) return fn(m).slice(0, 60)
  }
  // Fallback: first 6 words, Title Case.
  const words = p
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
  if (words.length === 0) return "Untitled Project"
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 60)
}

/** Lightweight category label for history cards. */
export function deriveCategory(prompt: string, files: Record<string, string>): string {
  if (files["index.html"]) return "Website"
  if (files["app.py"]) return "FastAPI App"
  const p = prompt.toLowerCase()
  if (/\blanding\b/.test(p)) return "Landing"
  if (/\bportfolio\b/.test(p)) return "Portfolio"
  if (/\btodo\b/.test(p)) return "Todo"
  if (/\bcountdown\b/.test(p)) return "Countdown"
  if (/\bquote\b/.test(p)) return "Content"
  if (/\bproduct\b/.test(p)) return "Commerce"
  return "Project"
}

/** Return all runs, newest first. */
export function listRuns(): HistoryRun[] {
  return [...safeRead()].sort((a, b) => b.finishedAt - a.finishedAt)
}

/** Return one run by id, or null. */
export function getRun(runId: string): HistoryRun | null {
  return safeRead().find((r) => r.runId === runId) ?? null
}

/** Idempotent upsert — if a run with the same id exists, replace it. */
export function upsertRun(run: HistoryRun): void {
  const trimmed: HistoryRun = {
    ...run,
    files: Object.fromEntries(
      Object.entries(run.files).map(([k, v]) => [
        k,
        typeof v === "string" && v.length > MAX_FILE_CHARS
          ? v.slice(0, MAX_FILE_CHARS) + "\n/* …truncated for storage… */"
          : String(v),
      ]),
    ),
  }
  const existing = safeRead().filter((r) => r.runId !== trimmed.runId)
  const next = [trimmed, ...existing].slice(0, MAX_ENTRIES)
  safeWrite(next)
}

/** Remove one run by id. */
export function removeRun(runId: string): void {
  safeWrite(safeRead().filter((r) => r.runId !== runId))
}

/** Clear all history. */
export function clearAllRuns(): void {
  safeWrite([])
}

/** Format an epoch-ms timestamp as "2 minutes ago", "3 hours ago", etc. */
export function formatRelative(ts: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return "Just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`
  const wk = Math.floor(day / 7)
  if (wk < 5) return `${wk} week${wk === 1 ? "" : "s"} ago`
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
