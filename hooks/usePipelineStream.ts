"use client"
import { useState, useEffect, useCallback } from "react"

export interface AgentEvent {
  event_type: "agent_start" | "agent_complete" | "test_result" | "status_update"
  agent: string
  task_id: string
  iteration: number
  payload: Record<string, unknown>
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
        const data: AgentEvent = JSON.parse(e.data)
        
        setEvents(prev => [...prev, data])
        
        // Update agent status cards
        if (data.event_type === "agent_start") {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: { name: data.agent, status: "RUNNING", iteration: data.iteration }
          }))
        }
        
        if (data.event_type === "agent_complete") {
          setAgentStatuses(prev => ({
            ...prev,
            [data.agent]: {
              ...prev[data.agent],
              status: "PASSED",
              lastOutput: String(data.payload?.output_summary || "")
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
          const newStatus = data.payload?.status as string
          setStatus(newStatus)
          
          // Fetch artifacts when finalized
          if (newStatus === "FINALIZED") {
            fetch(`/api/artifacts/${runId}`)
              .then(r => r.json())
              .then(d => setCodeFiles(d.files || {}))
              .catch(console.error)
          }
          
          if (["FINALIZED", "FAILED"].includes(newStatus)) {
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
