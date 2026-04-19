"use client"
import { AgentStatus } from "@/hooks/usePipelineStream"

const STATUS_STYLES: Record<
  string,
  { ring: string; text: string; bg: string; icon: string; label: string }
> = {
  PENDING: {
    ring: "border-white/10",
    text: "text-[var(--terminal-gray)]",
    bg: "bg-white/[0.02]",
    icon: "○",
    label: "PENDING",
  },
  RUNNING: {
    ring: "border-yellow-400/40 shadow-[0_0_12px_rgba(250,204,21,0.15)]",
    text: "text-[var(--terminal-yellow)]",
    bg: "bg-yellow-500/[0.06]",
    icon: "◌",
    label: "RUNNING",
  },
  PASSED: {
    ring: "border-green-400/40",
    text: "text-[var(--terminal-green)]",
    bg: "bg-green-500/[0.06]",
    icon: "✓",
    label: "PASSED",
  },
  FAILED: {
    ring: "border-red-400/40",
    text: "text-[var(--terminal-red)]",
    bg: "bg-red-500/[0.06]",
    icon: "✗",
    label: "FAILED",
  },
}

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
]

interface Props {
  agentStatuses: Record<string, AgentStatus>
}

export default function AgentStatusStrip({ agentStatuses }: Props) {
  return (
    <div className="w-full border-t border-[var(--terminal-border)] bg-[#080808]/80 backdrop-blur-md">
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)] shrink-0 pr-2 border-r border-white/10">
          Agents
        </span>
        <div className="flex items-center gap-2 flex-1">
          {AGENT_ORDER.map((agent) => {
            const s = agentStatuses[agent]?.status ?? "PENDING"
            const style = STATUS_STYLES[s] ?? STATUS_STYLES.PENDING
            const iter = agentStatuses[agent]?.iteration ?? 0
            return (
              <div
                key={agent}
                title={
                  agentStatuses[agent]?.lastOutput
                    ? `${agent}: ${agentStatuses[agent]?.lastOutput}`
                    : `${agent} — ${style.label}`
                }
                className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] ${style.ring} ${style.bg}`}
              >
                <span className={`font-bold ${style.text}`}>{style.icon}</span>
                <span className="text-white/90">{agent}</span>
                <span className={`${style.text} text-[10px] font-semibold`}>
                  {style.label}
                </span>
                {iter > 0 && s !== "PENDING" && (
                  <span className="text-[9px] text-[var(--terminal-gray)]">
                    · iter {iter}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
