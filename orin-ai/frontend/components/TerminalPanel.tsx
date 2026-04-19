"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronRight } from "lucide-react"
import { AgentEvent } from "@/hooks/usePipelineStream"

interface Props {
  testResults: AgentEvent[]
  events: AgentEvent[]
}

/**
 * Preferred agent order. Any agent we see that isn't in this list gets
 * appended at the end, in first-seen order, so new agents still show up.
 */
const AGENT_ORDER = [
  "Supervisor",
  "Researcher",
  "Persona",
  "Coordinator",
  "Architect",
  "Developer",
  "Critic",
  "Auditor",
  "Readme",
  "System",
]

type TerminalLine =
  | {
      kind: "start"
      timestamp: string
      agent: string
      taskId: string
      key: string
    }
  | {
      kind: "complete"
      timestamp: string
      agent: string
      preview: string
      stderr?: string
      key: string
    }
  | {
      kind: "test"
      timestamp: string
      passed: boolean
      iter: number
      stdout?: string
      stderr?: string
      key: string
    }
  | {
      kind: "status"
      timestamp: string
      status: string
      key: string
    }

function timeStr(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function previewFor(e: AgentEvent): string {
  const p = e.payload || {}
  const s =
    (p.output_summary as string) ||
    (p.stdout_preview as string) ||
    (p.readme_preview as string) ||
    (p.architecture as string) ||
    ""
  if (s) return s
  if (typeof p.audit_passed === "boolean")
    return `audit ${p.audit_passed ? "passed" : "failed"}`
  if (typeof p.test_passed === "boolean")
    return `tests ${p.test_passed ? "passed" : "failed"}`
  return ""
}

/**
 * Build a map of agent -> ordered lines. Status updates and Developer
 * test_results get routed to their logical owner (status -> "System",
 * test_result -> "Developer").
 */
function buildAgentBuckets(
  events: AgentEvent[],
): { agent: string; lines: TerminalLine[] }[] {
  const bucketMap = new Map<string, TerminalLine[]>()
  const seenOrder: string[] = []

  const push = (agent: string, line: TerminalLine) => {
    if (!bucketMap.has(agent)) {
      bucketMap.set(agent, [])
      seenOrder.push(agent)
    }
    bucketMap.get(agent)!.push(line)
  }

  events.forEach((e, i) => {
    const ts = e.timestamp
    const t = timeStr(ts)
    const baseKey = `${e.agent}-${e.event_type}-${e.iteration}-${i}`

    if (e.event_type === "agent_start") {
      push(e.agent || "System", {
        kind: "start",
        timestamp: t,
        agent: e.agent || "Agent",
        taskId: e.task_id,
        key: baseKey,
      })
      return
    }

    if (e.event_type === "agent_complete") {
      const stderrRaw = (e.payload?.stderr_preview as string) || ""
      push(e.agent || "System", {
        kind: "complete",
        timestamp: t,
        agent: e.agent || "Agent",
        preview: previewFor(e),
        stderr: stderrRaw ? String(stderrRaw).slice(0, 300) : undefined,
        key: baseKey,
      })
      return
    }

    if (e.event_type === "test_result") {
      const passed = Boolean(e.payload?.passed)
      push("Developer", {
        kind: "test",
        timestamp: t,
        passed,
        iter: e.iteration,
        stdout: e.payload?.stdout ? String(e.payload.stdout).slice(0, 500) : undefined,
        stderr: e.payload?.stderr ? String(e.payload.stderr).slice(0, 300) : undefined,
        key: baseKey,
      })
      return
    }

    if (e.event_type === "status_update") {
      const status =
        (typeof e.status === "string" && e.status) ||
        (e.payload?.status as string) ||
        (e.payload?.final_status as string) ||
        "UNKNOWN"
      push("System", {
        kind: "status",
        timestamp: t,
        status,
        key: baseKey,
      })
    }
  })

  // Sort agents by AGENT_ORDER preference, unknown agents keep first-seen order at the end.
  const known = AGENT_ORDER.filter((a) => bucketMap.has(a))
  const unknown = seenOrder.filter((a) => !AGENT_ORDER.includes(a))
  const finalOrder = [...known, ...unknown]

  return finalOrder.map((agent) => ({
    agent,
    lines: bucketMap.get(agent) ?? [],
  }))
}

const AGENT_COLOR: Record<string, string> = {
  Supervisor: "text-fuchsia-400",
  Researcher: "text-sky-400",
  Persona: "text-pink-400",
  Coordinator: "text-indigo-400",
  Architect: "text-amber-400",
  Developer: "text-emerald-400",
  Critic: "text-orange-400",
  Auditor: "text-purple-400",
  Readme: "text-cyan-400",
  System: "text-[var(--terminal-gray)]",
}

function agentAccent(agent: string): string {
  return AGENT_COLOR[agent] ?? "text-white/80"
}

export default function TerminalPanel({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const buckets = useMemo(() => buildAgentBuckets(events), [events])

  // Collapsed state: each agent defaults to expanded, user can close any.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (agent: string) =>
    setCollapsed((prev) => ({ ...prev, [agent]: !prev[agent] }))

  // Auto-scroll to bottom whenever new events arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [events.length])

  return (
    <div className="p-3 h-full flex flex-col">
      <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest mb-3 shrink-0">
        Terminal Output
      </h2>

      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed pr-1 space-y-3">
        <div className="text-[var(--terminal-gray)]">
          Orin AI v1.0 — autonomous pipeline initialized
        </div>

        {buckets.length === 0 ? (
          <div className="text-[var(--terminal-gray)]/70 italic">
            Waiting for the first agent to start…
          </div>
        ) : (
          buckets.map(({ agent, lines }) => {
            const isCollapsed = collapsed[agent] === true
            const accent = agentAccent(agent)
            const latest = lines[lines.length - 1]
            const hasFailure = lines.some(
              (l) =>
                (l.kind === "test" && !l.passed) ||
                (l.kind === "status" && (l.status === "FAILED" || l.status === "PANIC")),
            )
            return (
              <div
                key={agent}
                className="rounded-md border border-[var(--terminal-border)]/70 bg-white/[0.02] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(agent)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-white/50" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-white/50" />
                  )}
                  <span className={`font-bold ${accent}`}>[{agent}]</span>
                  <span className="text-[var(--terminal-gray)]">
                    {lines.length} event{lines.length === 1 ? "" : "s"}
                  </span>
                  {hasFailure && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-widest">
                      failure
                    </span>
                  )}
                  {!hasFailure && latest?.kind === "complete" && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                      done
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="border-t border-[var(--terminal-border)]/70"
                    >
                      <div className="px-3 py-2 space-y-1">
                        {lines.map((line, idx) => (
                          <TerminalLineView
                            key={line.key}
                            line={line}
                            index={idx}
                            accent={accent}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function TerminalLineView({
  line,
  index,
  accent,
}: {
  line: TerminalLine
  index: number
  accent: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.4) }}
    >
      {line.kind === "start" && (
        <div className="text-[var(--terminal-yellow)]">
          [{line.timestamp}] ▶ <span className={accent}>{line.agent}</span>{" "}
          starting task {line.taskId}
        </div>
      )}

      {line.kind === "complete" && (
        <>
          <div className="text-[var(--terminal-green)]">
            [{line.timestamp}] ✓ <span className={accent}>{line.agent}</span>{" "}
            complete{line.preview ? `: ${line.preview.slice(0, 80)}` : ""}
          </div>
          {line.stderr && (
            <pre className="text-[var(--terminal-red)] text-[11px] mt-1 ml-4 whitespace-pre-wrap opacity-70">
              {line.stderr}
            </pre>
          )}
        </>
      )}

      {line.kind === "test" && (
        <div className="my-1">
          <div
            className={
              line.passed ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"
            }
          >
            [{line.timestamp}] {line.passed ? "✓ TESTS PASSED" : "✗ TESTS FAILED"} (iter{" "}
            {line.iter})
          </div>
          {line.stdout && (
            <pre className="text-[var(--terminal-gray)] text-[11px] mt-1 ml-4 whitespace-pre-wrap">
              {line.stdout}
            </pre>
          )}
          {!line.passed && line.stderr && (
            <pre className="text-[var(--terminal-red)] text-[11px] mt-1 ml-4 whitespace-pre-wrap opacity-80">
              {line.stderr}
            </pre>
          )}
        </div>
      )}

      {line.kind === "status" && (
        <div
          className={
            "font-bold " +
            (line.status === "FINALIZED"
              ? "text-[var(--terminal-green)]"
              : line.status === "FAILED"
                ? "text-[var(--terminal-red)]"
                : line.status === "PANIC"
                  ? "text-orange-400"
                  : "text-[var(--terminal-gray)]")
          }
        >
          [{line.timestamp}] ═══ PIPELINE STATUS: {line.status} ═══
        </div>
      )}
    </motion.div>
  )
}
