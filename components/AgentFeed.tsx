import { AgentEvent, AgentStatus } from "@/hooks/usePipelineStream"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-[var(--terminal-gray)]",
  RUNNING: "text-[var(--terminal-yellow)]",
  PASSED:  "text-[var(--terminal-green)]",
  FAILED:  "text-[var(--terminal-red)]",
}

const STATUS_ICONS: Record<string, string> = {
  PENDING: "○",
  RUNNING: "◌",
  PASSED:  "✓",
  FAILED:  "✗",
}

const AGENT_ORDER = ["Supervisor", "Researcher", "Persona", "Architect", "Developer", "Critic", "Auditor"]

interface Props {
  agentStatuses: Record<string, AgentStatus>
  events: AgentEvent[]
}

function AgentCard({ agent, status }: { agent: string; status?: AgentStatus }) {
  const s = status?.status || "PENDING"
  const color = STATUS_COLORS[s]
  const icon  = STATUS_ICONS[s]
  
  return (
    <div className={`border border-[var(--terminal-border)] rounded p-3 mb-2 
                     bg-[#111] transition-all ${s === "RUNNING" ? "border-yellow-500/30" : ""}
                     ${s === "PASSED" ? "border-green-500/20" : ""}
                     ${s === "FAILED" ? "border-red-500/30" : ""}`}>
      <div className="flex justify-between items-center">
        <span className="font-mono text-sm text-[var(--terminal-text)]">{agent}</span>
        <span className={`text-xs font-bold font-mono ${color}`}>
          {icon} {s}
        </span>
      </div>
      {status && status.iteration > 0 && (
        <div className="text-xs text-[var(--terminal-gray)] font-mono mt-1">
          retry #{status.iteration}
        </div>
      )}
      {status?.lastOutput && (
        <div className="text-xs text-[var(--terminal-gray)] font-mono mt-1 truncate">
          {status.lastOutput}
        </div>
      )}
    </div>
  )
}

export default function AgentFeed({ agentStatuses, events }: Props) {
  const recentEvents = events.slice(-20)
  
  return (
    <div className="p-3 h-full flex flex-col">
      <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase 
                     tracking-widest mb-3 shrink-0">
        Agent Status
      </h2>
      
      <div className="flex-1 overflow-y-auto">
        {AGENT_ORDER.map(agent => (
          <AgentCard
            key={agent}
            agent={agent}
            status={agentStatuses[agent]}
          />
        ))}
        
        <div className="mt-4 border-t border-[var(--terminal-border)] pt-3">
          <h3 className="font-mono text-xs text-[var(--terminal-gray)] uppercase 
                         tracking-widest mb-2">
            Event Log
          </h3>
          <div className="space-y-1">
            {recentEvents.map((event, i) => (
              <div key={i} className="font-mono text-xs text-[var(--terminal-gray)]">
                <span className="text-[var(--terminal-blue)]">[{event.agent}]</span>{" "}
                {event.event_type}
                {event.iteration > 0 && (
                  <span className="text-orange-400"> iter:{event.iteration}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
