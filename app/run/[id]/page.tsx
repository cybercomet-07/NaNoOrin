"use client"
import PipelineWorkspace from "@/components/PipelineWorkspace"
import AgentChat from "@/components/AgentChat"
import ProcessFlow from "@/components/ProcessFlow"
import Link from "next/link"
import { use } from "react"
import { usePipelineStream } from "@/hooks/usePipelineStream"

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = use(params)
  const { events, status, agentStatuses, testResults, codeFiles, error } =
    usePipelineStream(runId)

  const statusColor = {
    RUNNING: "text-[var(--terminal-yellow)]",
    FINALIZED: "text-[var(--terminal-green)]",
    FAILED: "text-[var(--terminal-red)]",
    PANIC: "text-orange-400",
    IDLE: "text-[var(--terminal-gray)]",
  }[status] || "text-[var(--terminal-gray)]"

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2 
                          border-b border-[var(--terminal-border)] shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[var(--terminal-gray)] hover:text-white 
                                     font-mono text-sm transition-colors">
            ← Orin AI
          </Link>
          <span className="text-[var(--terminal-border)]">|</span>
          <span className="font-mono text-xs text-[var(--terminal-gray)] truncate max-w-xs">
            run/{runId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-[var(--terminal-red)] text-xs font-mono">{error}</span>
          )}
          <span className={`font-mono text-sm font-bold ${statusColor}`}>
            ● {status}
          </span>
        </div>
      </header>

      {/* Main 2-panel grid */}
      <div className="flex-1 grid grid-cols-[380px_1fr] gap-0 overflow-hidden">
        {/* Left: Interactive Agent Chat */}
        <div className="border-r border-[var(--terminal-border)] overflow-hidden">
          <AgentChat />
        </div>
        
        {/* Right: Unified Modular Workspace */}
        <div className="overflow-hidden">
          <PipelineWorkspace 
            events={events}
            status={status}
            agentStatuses={agentStatuses}
            testResults={testResults}
            codeFiles={codeFiles}
            runId={runId}
          />
        </div>
      </div>

      {/* BOTTOM LAYER: KINETIC PROCESS FLOW */}
      <div className="shrink-0">
        <ProcessFlow agentStatuses={agentStatuses} />
      </div>
    </div>
  )
}
