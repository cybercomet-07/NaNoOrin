"use client"
import { useState, useEffect, useCallback } from "react"

function previewFromAgentPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) return ""
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = payload[k]
      if (typeof v === "string" && v.trim()) return v.slice(0, 220)
    }
    return ""
  }
  const fromStrings = pick(
    "output_summary",
    "stdout_preview",
    "tech_rationale",
    "readme_preview",
    "stdout",
  )
  if (fromStrings) return fromStrings
  if (typeof payload.audit_passed === "boolean") {
    return `audit ${payload.audit_passed ? "passed" : "failed"}`
  }
  if (typeof payload.test_passed === "boolean") {
    return `tests ${payload.test_passed ? "passed" : "failed"}`
  }
  return ""
}

export interface AgentEvent {
  event_type: "agent_start" | "agent_complete" | "test_result" | "status_update"
  agent: string
  task_id: string
  iteration: number
  payload: Record<string, unknown>
  /** Pipeline status from FastAPI `make_event` (top-level); not inside `payload`. */
  status?: string
  timestamp: string
}

export interface AgentStatus {
  name: string
  status: "PENDING" | "RUNNING" | "PASSED" | "FAILED"
  iteration: number
  lastOutput?: string
}

export function usePipelineStream(runId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [status, setStatus] = useState<string>("IDLE")
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({})
  const [testResults, setTestResults] = useState<AgentEvent[]>([])
  const [codeFiles, setCodeFiles] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) return

    const es = new EventSource(`/api/stream/${runId}`)

    es.onmessage = (e) => {
      try {
        if (!e.data || e.data.trim() === "") return
        const data: AgentEvent = JSON.parse(e.data)
        setError(null)

        setEvents(prev => [...prev, data])
        
        // Update agent status cards
        if (data.event_type === "agent_start") {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: { name: data.agent, status: "RUNNING", iteration: data.iteration }
          }))
        }
        
        if (data.event_type === "agent_complete") {
          const p = data.payload as Record<string, unknown> | undefined
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: {
              ...prev[data.agent],
              name: data.agent,
              status: "PASSED",
              iteration: data.iteration,
              lastOutput: previewFromAgentPayload(p),
            }
          }))
        }
        
        if (data.event_type === "test_result") {
          setTestResults(prev => [...prev, data])
          const passed = data.payload?.passed as boolean
          setAgentStatuses(prev => ({
            ...prev,
            Developer: {
              ...prev.Developer,
              status: passed ? "PASSED" : "FAILED",
              iteration: data.iteration
            }
          }))
        }
        
        if (data.event_type === "status_update") {
          const newStatus =
            (typeof data.status === "string" && data.status
              ? data.status
              : (data.payload?.status as string | undefined) ??
                (data.payload?.final_status as string | undefined)) ?? ""
          if (newStatus) setStatus(newStatus)
          
          // Fetch whatever artifacts exist — backend returns partial files on
          // FAILED/PANIC runs too, which lets the Code tab show partial output
          // instead of a blank "No files" state.
          if (["FINALIZED", "FAILED", "PANIC"].includes(newStatus)) {
            fetch(`/api/artifacts/${runId}`)
              .then(r => r.json())
              .then((d: { files?: Record<string, string> }) =>
                setCodeFiles(d.files ?? {}),
              )
              .catch(console.error)
            es.close()
          }
        }
      } catch (err) {
        console.error("SSE parse error:", err)
      }
    }

    es.onerror = () => {
      setError("Connection lost. Retrying...")
      // EventSource auto-retries — don't manually close
    }

    return () => es.close()
  }, [runId])

  const reset = useCallback(() => {
    setEvents([])
    setStatus("IDLE")
    setAgentStatuses({})
    setTestResults([])
    setCodeFiles({})
    setError(null)
  }, [])

  return { events, status, agentStatuses, testResults, codeFiles, error, reset }
}
