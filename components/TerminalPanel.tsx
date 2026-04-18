"use client"
import { useEffect, useRef } from "react"
import { AgentEvent } from "@/hooks/usePipelineStream"

interface Props {
  testResults: AgentEvent[]
  events: AgentEvent[]
}

export default function TerminalPanel({ testResults, events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new events — simulates live terminal
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events, testResults])

  const allLines = events.map((e, i) => {
    const time = new Date(e.timestamp).toLocaleTimeString("en-US", {
      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit"
    })
    
    if (e.event_type === "agent_start") {
      return (
        <div key={i} className="text-[var(--terminal-yellow)]">
          [{time}] ▶ {e.agent} starting task {e.task_id}
        </div>
      )
    }
    
    if (e.event_type === "agent_complete") {
      // Render from whatever keys the backend sends
      const preview = 
        e.payload?.output_summary ||
        e.payload?.stdout_preview ||
        e.payload?.readme_preview ||
        e.payload?.architecture ||
        (e.payload?.audit_passed !== undefined ? `audit ${e.payload.audit_passed ? "passed" : "failed"}` : "") ||
        (e.payload?.test_passed !== undefined ? `tests ${e.payload.test_passed ? "passed" : "failed"}` : "") ||
        ""
      const stderr = e.payload?.stderr_preview ? String(e.payload.stderr_preview) : ""
      return (
        <div key={i}>
          <div className="text-[var(--terminal-green)]">
            [{time}] ✓ {e.agent} complete{preview ? `: ${String(preview).slice(0, 80)}` : ""}
          </div>
          {stderr && (
            <pre className="text-[var(--terminal-red)] text-xs mt-1 ml-4 whitespace-pre-wrap opacity-70">
              {stderr.slice(0, 300)}
            </pre>
          )}
        </div>
      )
    }
    
    if (e.event_type === "test_result") {
      const passed = e.payload?.passed as boolean
      const stdout = String(e.payload?.stdout || "")
      const stderr = String(e.payload?.stderr || "")
      
      return (
        <div key={i} className="my-2">
          <div className={passed ? "text-[var(--terminal-green)]" : "text-[var(--terminal-red)]"}>
            [{time}] {passed ? "✓ TESTS PASSED" : "✗ TESTS FAILED"} (iter {e.iteration})
          </div>
          {stdout && (
            <pre className="text-[var(--terminal-gray)] text-xs mt-1 ml-4 whitespace-pre-wrap">
              {stdout.slice(0, 500)}
            </pre>
          )}
          {!passed && stderr && (
            <pre className="text-[var(--terminal-red)] text-xs mt-1 ml-4 whitespace-pre-wrap opacity-80">
              {stderr.slice(0, 300)}
            </pre>
          )}
        </div>
      )
    }
    
    if (e.event_type === "status_update") {
      // Fallback: use event.status if payload.status is missing
      const status = (e.payload?.status as string) || ((e as unknown as Record<string, unknown>).status as string) || "UNKNOWN"
      const color = status === "FINALIZED" ? "text-[var(--terminal-green)]" :
                    status === "FAILED"    ? "text-[var(--terminal-red)]"   :
                    status === "PANIC"     ? "text-orange-400" :
                    "text-[var(--terminal-gray)]"
      return (
        <div key={i} className={`font-bold ${color}`}>
          [{time}] ═══ PIPELINE STATUS: {status} ═══
        </div>
      )
    }
    
    return null
  })

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
        <div className="text-[var(--terminal-gray)] mb-2">
          Orin AI v1.0 — autonomous pipeline initialized
        </div>
        {allLines}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
