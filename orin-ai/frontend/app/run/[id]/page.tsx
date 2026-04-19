"use client"
import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { usePipelineStream } from "@/hooks/usePipelineStream"
import PipelineWorkspace from "@/components/PipelineWorkspace"
import ChatPanel from "@/components/ChatPanel"
import AgentStatusStrip from "@/components/AgentStatusStrip"
import AuthGuard from "@/components/AuthGuard"
import {
  RunToolbarToggles,
  RunLogsOverlay,
  type LogsTab,
} from "@/components/RunToolbar"
import { useAuth } from "@/hooks/useAuth"
import { SnowBackground } from "@/components/shared/SnowBackground"

function RunPageInner({ runId }: { runId: string }) {
  const { events, status, agentStatuses, testResults, codeFiles, error } =
    usePipelineStream(runId)
  const router = useRouter()
  const { session, logout } = useAuth()
  const [logsTab, setLogsTab] = useState<LogsTab>(null)

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  const statusColor =
    {
      RUNNING: "text-[var(--terminal-yellow)]",
      FINALIZED: "text-[var(--terminal-green)]",
      FAILED: "text-[var(--terminal-red)]",
      PANIC: "text-orange-400",
      IDLE: "text-[var(--terminal-gray)]",
    }[status] || "text-[var(--terminal-gray)]"

  return (
    <SnowBackground density={0.05} brightness={0.4} className="h-screen bg-[#050505]">
      <div className="h-full flex flex-col overflow-hidden backdrop-blur-[2px]">
        {/* Header bar */}
        <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--terminal-border)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="text-[var(--terminal-gray)] hover:text-white font-mono text-sm transition-colors shrink-0"
            >
              ← Orin AI
            </Link>
            <span className="text-[var(--terminal-border)] shrink-0">|</span>
            <span className="font-mono text-xs text-[var(--terminal-gray)] truncate">
              run/{runId}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Terminal / Event Log toggles — moved here per spec */}
            <RunToolbarToggles active={logsTab} onChange={setLogsTab} />

            <span className="text-[var(--terminal-border)]">|</span>

            {error && (
              <span className="text-[var(--terminal-red)] text-xs font-mono max-w-[200px] truncate">
                {error}
              </span>
            )}
            <span className={`font-mono text-sm font-bold ${statusColor}`}>
              ● {status}
            </span>
            <span className="text-[var(--terminal-border)]">|</span>
            {session && (
              <span className="font-mono text-xs text-[var(--terminal-gray)] hidden md:inline max-w-[180px] truncate">
                {session.email}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 text-[var(--terminal-gray)] hover:text-white hover:bg-white/5 font-mono text-xs transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main body: chat drawer + center workspace. Overlay is anchored here. */}
        <div className="flex-1 flex overflow-hidden relative">
          <ChatPanel runId={runId} status={status} />

          <main className="flex-1 overflow-hidden relative">
            <PipelineWorkspace
              events={events}
              status={status}
              agentStatuses={agentStatuses}
              testResults={testResults}
              codeFiles={codeFiles}
              runId={runId}
            />

            {/* Slide-down overlay anchored to the center region */}
            <RunLogsOverlay
              tab={logsTab}
              events={events}
              testResults={testResults}
              onClose={() => setLogsTab(null)}
            />
          </main>
        </div>

        {/* Horizontal agent status strip (bottom, full width) */}
        <AgentStatusStrip agentStatuses={agentStatuses} />
      </div>
    </SnowBackground>
  )
}

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = use(params)
  return (
    <AuthGuard>
      <RunPageInner runId={runId} />
    </AuthGuard>
  )
}
