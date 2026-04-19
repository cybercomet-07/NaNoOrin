"use client"
import { useEffect } from "react"
import { ListTree, Terminal as TerminalIcon, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import TerminalPanel from "./TerminalPanel"
import EventLog from "./EventLog"
import { AgentEvent } from "@/hooks/usePipelineStream"

export type LogsTab = "TERMINAL" | "EVENT_LOG" | null

interface ToggleProps {
  active: LogsTab
  onChange: (tab: LogsTab) => void
}

export function RunToolbarToggles({ active, onChange }: ToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-0.5">
      <ToggleButton
        label="Terminal"
        icon={<TerminalIcon className="w-3 h-3" />}
        isActive={active === "TERMINAL"}
        onClick={() => onChange(active === "TERMINAL" ? null : "TERMINAL")}
      />
      <ToggleButton
        label="Event Log"
        icon={<ListTree className="w-3 h-3" />}
        isActive={active === "EVENT_LOG"}
        onClick={() => onChange(active === "EVENT_LOG" ? null : "EVENT_LOG")}
      />
    </div>
  )
}

function ToggleButton({
  label,
  icon,
  isActive,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest transition-colors ${
        isActive
          ? "bg-white text-black font-bold"
          : "text-[var(--terminal-gray)] hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

interface OverlayProps {
  tab: LogsTab
  events: AgentEvent[]
  testResults: AgentEvent[]
  onClose: () => void
}

export function RunLogsOverlay({ tab, events, testResults, onClose }: OverlayProps) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [onClose])

  return (
    <AnimatePresence>
      {tab !== null && (
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute left-0 right-0 top-0 z-40 mx-3 mt-2 rounded-xl border border-[var(--terminal-border)] bg-[#070707]/95 backdrop-blur-md shadow-2xl shadow-black/50 overflow-hidden"
          style={{ maxHeight: "55vh", height: "55vh" }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--terminal-border)] bg-[#050505]/80">
            <div className="flex items-center gap-2">
              {tab === "TERMINAL" ? (
                <TerminalIcon className="w-3.5 h-3.5 text-primary" />
              ) : (
                <ListTree className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="font-mono text-[11px] uppercase tracking-widest text-white/85">
                {tab === "TERMINAL" ? "Terminal Output" : "Event Log"}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-[calc(100%-40px)] overflow-hidden">
            {tab === "TERMINAL" ? (
              <TerminalPanel events={events} testResults={testResults} />
            ) : (
              <EventLog events={events} hideHeader />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
