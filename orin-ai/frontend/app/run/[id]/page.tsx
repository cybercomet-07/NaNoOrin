"use client"
import { use } from "react"
import { usePipelineStream } from "@/hooks/usePipelineStream"
import AgentFeed from "@/components/AgentFeed"
import TerminalPanel from "@/components/TerminalPanel"
import ArtifactPanel from "@/components/ArtifactPanel"
import Link from "next/link"

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

      {/* 3-panel grid — matches PDF Section 08 layout exactly */}
      <div className="flex-1 grid grid-cols-3 gap-0 overflow-hidden">
        {/* Left: Agent Feed */}
        <div className="border-r border-[var(--terminal-border)] overflow-y-auto">
          <AgentFeed agentStatuses={agentStatuses} events={events} />
        </div>
        
        {/* Center: Terminal Output */}
        <div className="border-r border-[var(--terminal-border)] overflow-hidden flex flex-col">
          <TerminalPanel testResults={testResults} events={events} />
        </div>
        
        {/* Right: Artifacts */}
        <div className="overflow-hidden flex flex-col">
          <ArtifactPanel codeFiles={codeFiles} runId={runId} status={status} />
        </div>
      </div>
    </div>
  )
}
