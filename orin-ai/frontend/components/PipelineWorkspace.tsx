"use client"
import { useEffect, useState } from "react"
import { AgentEvent } from "@/hooks/usePipelineStream"
import ArtifactPanel from "./ArtifactPanel"
import { motion, AnimatePresence } from "framer-motion"
import ReactMarkdown from "react-markdown"

interface Props {
  events: AgentEvent[]
  status: string
  agentStatuses: Record<string, unknown>
  testResults: AgentEvent[]
  codeFiles: Record<string, string>
  runId: string
}

type Tab = "PREVIEW" | "CODE"

const OrinIcon = ({ type }: { type: Tab }) => (
  <div className={`w-4 h-4 mr-2 flex items-center justify-center rounded-sm ${type === "PREVIEW" ? "bg-primary/20 text-primary" : "bg-secondary/20 text-secondary"}`}>
    {type === "PREVIEW" ? (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ) : (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )}
  </div>
);

export default function PipelineWorkspace({ events, status, codeFiles, runId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("PREVIEW")
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`orin:prompt:${runId}`)
      setOriginalPrompt(stored ?? null)
    } catch {
      setOriginalPrompt(null)
    }
  }, [runId])

  useEffect(() => {
    if (status === "FINALIZED") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Generate period calculation (total events duration)
  const startTime = events.length > 0 ? new Date(events[0].timestamp).getTime() : 0;
  const lastTime = events.length > 0 ? new Date(events[events.length - 1].timestamp).getTime() : 0;
  const elapsedSec = startTime
    ? Math.floor(
        (status === "FINALIZED" ? lastTime - startTime : nowMs - startTime) / 1000
      )
    : 0;

  return (
    <div className="h-full flex flex-col bg-transparent relative overflow-hidden backdrop-blur-[1px]">
      {/* Centered Tab Navigation */}
      <div className="border-b border-white/5 bg-surface/30 backdrop-blur-md flex justify-center items-center py-2 px-4 shadow-lg shrink-0">
        <div className="flex bg-white/5 p-1 rounded-full border border-white/5 space-x-1">
          <button
            onClick={() => setActiveTab("PREVIEW")}
            className={`flex items-center px-6 py-2 rounded-full text-[10px] font-mono transition-all relative uppercase tracking-widest ${
              activeTab === "PREVIEW" ? "bg-white text-black font-bold shadow-md" : "text-[var(--terminal-gray)] hover:text-white"
            }`}
          >
            <OrinIcon type="PREVIEW" />
            PREVIEW
          </button>
          <button
            onClick={() => setActiveTab("CODE")}
            className={`flex items-center px-6 py-2 rounded-full text-[10px] font-mono transition-all relative uppercase tracking-widest ${
              activeTab === "CODE" ? "bg-white text-black font-bold shadow-md" : "text-[var(--terminal-gray)] hover:text-white"
            }`}
          >
            <OrinIcon type="CODE" />
            CODE
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {activeTab === "PREVIEW" && (
              <div className="p-8 md:p-12 h-full overflow-y-auto">
                {status === "FINALIZED" && codeFiles["README.md"] ? (
                  <div className="max-w-3xl mx-auto bg-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">
                          Generated README
                        </div>
                        <h2 className="text-2xl font-bold text-white">{`Your project is ready`}</h2>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--terminal-green)]">
                        ✓ {Object.keys(codeFiles).length} files
                      </span>
                    </div>
                    <article className="orin-markdown text-white/80 text-sm leading-relaxed">
                      <ReactMarkdown>{codeFiles["README.md"]}</ReactMarkdown>
                    </article>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                {/* LARGE RECTANGULAR STAT BOARD */}
                <div className="w-full max-w-2xl bg-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl p-10 relative overflow-hidden group shadow-2xl">
                  {/* Decorative corner glow */}
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full group-hover:bg-primary/30 transition-all duration-700" />
                  <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/20 blur-[80px] rounded-full group-hover:bg-secondary/30 transition-all duration-700" />
                  
                  <div className="relative z-10 text-center flex flex-col items-center">
                    <div className="inline-flex items-center justify-center p-3 rounded-xl bg-white/5 mb-6 border border-white/10">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Active Run Analysis</h2>
                    <p className="text-[var(--terminal-gray)] font-mono text-sm mb-10 max-w-sm">
                      Autonomous synthesis in progress. Current pipeline period tracking.
                    </p>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="bg-white/5 border border-white/5 p-6 rounded-2xl flex flex-col items-center">
                        <span className="text-[10px] text-[var(--terminal-gray)] uppercase tracking-widest mb-2 font-mono">Generation Period</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-mono">
                          {elapsedSec}s
                        </span>
                      </div>
                      <div className="bg-white/5 border border-white/5 p-6 rounded-2xl flex flex-col items-center">
                        <span className="text-[10px] text-[var(--terminal-gray)] uppercase tracking-widest mb-2 font-mono">Active Artifacts</span>
                        <span className="text-3xl font-bold text-white font-mono">
                          {Object.keys(codeFiles).length}
                        </span>
                      </div>
                    </div>

                    <div className="mt-8 w-full">
                       <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[var(--terminal-gray)] mb-2">
                          <span>Pipeline Health</span>
                          <span className="text-[var(--terminal-green)]">Optimal</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: status === "FINALIZED" ? "100%" : "65%" }}
                             className={`h-full bg-gradient-to-r ${status === "FINALIZED" ? "from-[var(--terminal-green)] to-emerald-400" : "from-primary to-secondary"}`}
                          />
                       </div>
                    </div>
                  </div>
                </div>
                </div>
                )}
              </div>
            )}

            {activeTab === "CODE" && (
              <div className="p-8 h-full flex flex-col items-center">
                 <div className="w-full h-full max-w-5xl bg-surface/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 relative overflow-hidden flex flex-col shadow-2xl">
                    <ArtifactPanel codeFiles={codeFiles} runId={runId} status={status} prompt={originalPrompt} />
                 </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
