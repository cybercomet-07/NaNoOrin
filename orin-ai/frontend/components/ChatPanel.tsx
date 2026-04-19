"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, Loader2, MessageSquare, RefreshCw, Send, User } from "lucide-react"
import { startPipelineRun } from "@/lib/pipeline"

type Role = "user" | "assistant"

interface ChatMessage {
  id: string
  role: Role
  content: string
  ts: number
  /** Optional UI kind so we can render a system-style message differently. */
  kind?: "default" | "system"
}

interface Props {
  runId: string
  status: string
}

const CHAT_KEY = (runId: string) => `orin:chat:${runId}`
const PROMPT_KEY = (runId: string) => `orin:prompt:${runId}`

function nowId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Matches phrases that clearly mean "kick off a new run", so we can auto-retry
 * instead of just logging the message. Intentionally strict — we'd rather miss
 * an edge case than wipe someone's in-progress run by accident.
 */
const RETRY_INTENT_RE =
  /\b(do\s+it\s+again|try\s+again|run\s+it\s+again|retry|re[-\s]?run|rerun|restart|start\s+over|try\s+one\s+more\s+time)\b/i

function isRetryIntent(text: string): boolean {
  return RETRY_INTENT_RE.test(text.trim())
}

/**
 * Find the original prompt for this run. Primary source is sessionStorage set
 * by the demo-prompts page at launch; fall back to the first user bubble in
 * the saved chat history (which we seed with the original prompt on first load).
 */
function findOriginalPrompt(runId: string, messages: ChatMessage[]): string | null {
  try {
    const fromSession = sessionStorage.getItem(PROMPT_KEY(runId))
    if (fromSession && fromSession.trim()) return fromSession.trim()
  } catch {
    // ignore
  }
  const firstUser = messages.find((m) => m.role === "user")
  return firstUser ? firstUser.content : null
}

function buildAssistantReply(userText: string, status: string): string {
  const trimmed = userText.trim()
  const lower = trimmed.toLowerCase()

  if (status === "RUNNING") {
    return (
      "Noted — I'll apply this to the next iteration:\n" +
      `  • ${trimmed}\n` +
      "The agents are still working on the current run. Follow-up edits will be queued for the next revision."
    )
  }

  if (status === "FINALIZED") {
    if (lower.includes("add") || lower.includes("endpoint") || lower.includes("feature")) {
      return (
        "Got it. To add that to the generated project, kick off a new run with an updated prompt. " +
        "I've saved your request here:\n" +
        `  • ${trimmed}`
      )
    }
    if (lower.includes("fix") || lower.includes("bug") || lower.includes("error")) {
      return (
        "Acknowledged. Saved this fix request. Re-run the pipeline from Demo Prompts with a refined prompt to apply it:\n" +
        `  • ${trimmed}`
      )
    }
    return (
      "Saved to this chat. The current project has finalized — start a fresh run to apply:\n" +
      `  • ${trimmed}`
    )
  }

  // FAILED / PANIC / anything else — note that retry-intent is handled
  // separately above this function in `send()`, so by the time we get here
  // the user didn't ask to retry.
  if (status === "FAILED" || status === "PANIC") {
    return (
      "Understood. The current run already failed, so this feedback is saved here. " +
      "Type \"do it again\" to retry with the original prompt, or add more detail and retry:\n" +
      `  • ${trimmed}`
    )
  }

  return (
    "Saved. This chat preserves your prompt edits; the live pipeline doesn't accept mid-run changes yet.\n" +
    `  • ${trimmed}`
  )
}

export default function ChatPanel({ runId, status }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY(runId))
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setMessages(parsed as ChatMessage[])
          setHydrated(true)
          return
        }
      }

      const seed: ChatMessage[] = []
      try {
        const originalPrompt = sessionStorage.getItem(PROMPT_KEY(runId))
        if (originalPrompt && originalPrompt.trim()) {
          seed.push({
            id: nowId(),
            role: "user",
            content: originalPrompt.trim(),
            ts: Date.now(),
          })
          seed.push({
            id: nowId(),
            role: "assistant",
            content:
              "Kicked off the pipeline for your prompt. Watch the agent strip at the bottom for live status. " +
              "You can drop follow-up edits here and I'll record them for the next run.",
            ts: Date.now() + 1,
          })
        } else {
          seed.push({
            id: nowId(),
            role: "assistant",
            content:
              "Welcome. This chat is scoped to this run. Type changes you'd like applied to the generated project and I'll record them.",
            ts: Date.now(),
          })
        }
      } catch {
        // sessionStorage unavailable — fall through
      }
      setMessages(seed)
    } catch {
      // ignore storage errors
    } finally {
      setHydrated(true)
    }
  }, [runId])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(CHAT_KEY(runId), JSON.stringify(messages))
    } catch {
      // ignore quota / disabled storage
    }
  }, [messages, runId, hydrated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length])

  const retryRunWithOriginalPrompt = async (): Promise<void> => {
    if (retrying) return
    const prompt = findOriginalPrompt(runId, messages)
    if (!prompt) {
      setMessages((prev) => [
        ...prev,
        {
          id: nowId(),
          role: "assistant",
          content:
            "I couldn't find the original prompt for this run. Head to Demo Prompts and pick one to try again.",
          ts: Date.now(),
          kind: "system",
        },
      ])
      return
    }

    setRetrying(true)
    setMessages((prev) => [
      ...prev,
      {
        id: nowId(),
        role: "assistant",
        content: `Retrying with the original prompt:\n  • ${prompt}`,
        ts: Date.now(),
        kind: "system",
      },
    ])

    try {
      const newRunId = await startPipelineRun(prompt)
      try {
        sessionStorage.setItem(PROMPT_KEY(newRunId), prompt)
      } catch {
        // ignore storage failures
      }
      router.push(`/run/${newRunId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start a new run."
      setMessages((prev) => [
        ...prev,
        {
          id: nowId(),
          role: "assistant",
          content: `Retry failed: ${msg}`,
          ts: Date.now(),
          kind: "system",
        },
      ])
      setRetrying(false)
    }
  }

  const send = () => {
    const text = input.trim()
    if (!text) return
    const userMsg: ChatMessage = {
      id: nowId(),
      role: "user",
      content: text,
      ts: Date.now(),
    }

    // Auto-retry: on a failed/panicked run, interpret common retry phrases as
    // "start a new run with the original prompt".
    const retryRequested =
      (status === "FAILED" || status === "PANIC") && isRetryIntent(text)

    if (retryRequested) {
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      void retryRunWithOriginalPrompt()
      return
    }

    const reply: ChatMessage = {
      id: nowId(),
      role: "assistant",
      content: buildAssistantReply(text, status),
      ts: Date.now() + 1,
    }
    setMessages((prev) => [...prev, userMsg, reply])
    setInput("")
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  return (
    <aside className="shrink-0 w-[360px] border-r border-[var(--terminal-border)] bg-[#080808]/70 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[var(--terminal-border)]">
        <MessageSquare className="w-4 h-4 text-primary" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-white/80">
          Chat
        </span>
        <span className="ml-auto font-mono text-[10px] text-[var(--terminal-gray)]">
          run {runId.slice(0, 8)}…
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[var(--terminal-border)] bg-[#050505]/70 p-3">
        {(status === "FAILED" || status === "PANIC") && (
          <button
            type="button"
            onClick={() => void retryRunWithOriginalPrompt()}
            disabled={retrying}
            className="mb-2 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 disabled:opacity-50 disabled:cursor-not-allowed text-primary font-mono text-[11px] uppercase tracking-widest py-2 transition-colors"
          >
            {retrying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Starting new run…
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Retry with original prompt
              </>
            )}
          </button>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-primary/40 transition-colors px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResize(e.currentTarget)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={
              status === "FAILED" || status === "PANIC"
                ? "Type 'do it again' to retry, or describe what to change…"
                : "Describe a change you want… (Shift+Enter for newline)"
            }
            disabled={retrying}
            className="flex-1 bg-transparent resize-none text-[13px] text-white/90 placeholder:text-[var(--terminal-gray)] focus:outline-none font-sans leading-snug disabled:opacity-50"
            style={{ maxHeight: 140 }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || retrying}
            title="Send (Enter)"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-black hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-2 text-[10px] font-mono text-[var(--terminal-gray)]">
          {status === "FAILED" || status === "PANIC"
            ? "Say \"do it again\" or \"retry\" to kick off a fresh pipeline run."
            : "Changes are recorded locally — start a new run from Demo Prompts to apply them."}
        </p>
      </div>
    </aside>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  const isSystem = message.kind === "system"
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
          isUser
            ? "bg-primary/15 border-primary/30 text-primary"
            : isSystem
              ? "bg-amber-500/10 border-amber-400/30 text-amber-300"
              : "bg-white/5 border-white/10 text-white/70"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : isSystem ? (
          <RefreshCw className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>
      <div
        className={`max-w-[86%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words border ${
          isUser
            ? "rounded-tr-sm bg-primary/[0.08] border-primary/20 text-white"
            : isSystem
              ? "rounded-tl-sm bg-amber-500/[0.06] border-amber-400/20 text-amber-100/95 font-mono text-[12px]"
              : "rounded-tl-sm bg-white/[0.03] border-white/10 text-white/85"
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
