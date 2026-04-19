"use client"
import { motion } from "framer-motion"
import { AgentStatus } from "@/hooks/usePipelineStream"

const AGENT_ORDER = ["Supervisor", "Researcher", "Persona", "Architect", "Developer", "Critic", "Auditor", "Readme"]

interface Props {
  agentStatuses: Record<string, AgentStatus>
}

export default function ProcessFlow({ agentStatuses }: Props) {
  // Find current active agent index
  const activeIndex = AGENT_ORDER.findIndex(agent => 
    agentStatuses[agent]?.status === "RUNNING"
  )
  
  // If no one is running, maybe find the last one that passed
  const lastPassedIndex = [...AGENT_ORDER].reverse().findIndex(agent => 
    agentStatuses[agent]?.status === "PASSED"
  )
  const displayIndex = activeIndex !== -1 ? activeIndex : (lastPassedIndex !== -1 ? (AGENT_ORDER.length - 1 - lastPassedIndex) : -1)

  return (
    <div className="w-full bg-surface/30 backdrop-blur-md border-t border-[var(--terminal-border)] p-4 relative z-50">
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none -z-10" />
      <div className="max-w-6xl mx-auto flex items-center justify-between px-8 relative">
        {/* Background Connection Line */}
        <div className="absolute top-1/2 left-16 right-16 h-[1px] bg-white/10 -translate-y-1/2 z-0" />
        
        {AGENT_ORDER.map((agent, idx) => {
          const status = agentStatuses[agent]?.status || "PENDING"
          const isActive = idx === displayIndex
          const isPassed = status === "PASSED"
          
          return (
            <div key={agent} className="flex flex-col items-center gap-2 relative z-10">
              <div className="relative">
                {/* Connection Line segment (glowing if passed) */}
                {idx < AGENT_ORDER.length - 1 && (
                  <div className={`absolute top-1/2 left-full w-[calc(100%)] h-[2px] -translate-y-1/2 transition-all duration-1000 ${
                    isPassed ? "bg-[var(--terminal-green)] shadow-[0_0_10px_var(--terminal-green)]" : "bg-transparent"
                  }`} style={{ width: '4.5rem' }} />
                )}

                {/* Circle Node */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.2 : 1,
                    backgroundColor: isActive ? "var(--terminal-yellow)" : (isPassed ? "var(--terminal-green)" : "#111"),
                    borderColor: isActive ? "rgba(255,255,255,0.2)" : (isPassed ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.05)")
                  }}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors relative`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="pulsar"
                      className="absolute inset-0 rounded-full bg-[var(--terminal-yellow)]/30"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <span className={`text-[10px] font-bold ${isActive ? "text-black" : (isPassed ? "text-black" : "text-[var(--terminal-gray)]")}`}>
                    {isPassed ? "✓" : idx + 1}
                  </span>
                </motion.div>
              </div>

              <span className={`text-[10px] font-mono uppercase tracking-tighter ${
                isActive ? "text-[var(--terminal-yellow)] font-bold" : (isPassed ? "text-[var(--terminal-green)]" : "text-[var(--terminal-gray)]")
              }`}>
                {agent}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
