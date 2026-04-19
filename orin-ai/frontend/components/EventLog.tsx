"use client"
import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Activity, CheckCircle2, FlaskConical, Play } from "lucide-react"
import { AgentEvent } from "@/hooks/usePipelineStream"

interface Props {
  events: AgentEvent[]
  /** Hide the header row when embedded in an overlay with its own header. */
  hideHeader?: boolean
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

function iconFor(eventType: AgentEvent["event_type"]) {
  if (eventType === "agent_start")
    return <Play className="w-3 h-3 text-[var(--terminal-yellow)]" />
  if (eventType === "agent_complete")
    return <CheckCircle2 className="w-3 h-3 text-[var(--terminal-green)]" />
  if (eventType === "test_result")
    return <FlaskConical className="w-3 h-3 text-fuchsia-400" />
  return <Activity className="w-3 h-3 text-white/60" />
}

function relTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export default function EventLog({ events, hideHeader = false }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const recent = events.slice(-200)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [events.length])

  return (
    <div className="p-3 h-full flex flex-col">
      {!hideHeader && (
        <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest mb-3 shrink-0">
          Event Log
        </h2>
      )}
      <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 pr-1">
        {recent.length === 0 ? (
          <div className="text-[var(--terminal-gray)]">No events yet…</div>
        ) : (
          <AnimatePresence initial={false}>
            {recent.map((event, i) => {
              const accent = AGENT_COLOR[event.agent] ?? "text-white/80"
              // unique key so React can't reuse rows on prepend
              const rowKey = `${event.timestamp}-${event.agent}-${event.event_type}-${event.iteration}-${i}`
              return (
                <motion.div
                  key={rowKey}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(i * 0.02, 0.3),
                  }}
                  className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/[0.03]"
                >
                  {iconFor(event.event_type)}
                  <span className="text-[10px] text-[var(--terminal-gray)] shrink-0 w-[58px]">
                    {relTime(event.timestamp)}
                  </span>
                  <span className={`font-bold shrink-0 ${accent}`}>
                    [{event.agent}]
                  </span>
                  <span className="text-white/80">{event.event_type}</span>
                  {event.iteration > 0 && (
                    <span className="ml-auto text-orange-400 text-[10px]">
                      iter:{event.iteration}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
