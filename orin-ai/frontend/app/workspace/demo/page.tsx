"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, Gauge, Loader2, Sparkles, Timer, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_PROMPTS, type DemoPrompt } from "@/lib/demoPrompts"
import { startPipelineRun } from "@/lib/pipeline"

const TAG_STYLES: Record<DemoPrompt["tag"], string> = {
  WEB: "bg-primary/15 text-primary border-primary/30",
  UI: "bg-secondary/15 text-secondary border-secondary/30",
  PAGE: "bg-white/10 text-white border-white/20",
}

export default function DemoPromptsPage() {
  const [selectedId, setSelectedId] = useState<string>(DEMO_PROMPTS[0].id)
  const [prompt, setPrompt] = useState<string>(DEMO_PROMPTS[0].prompt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const selected = DEMO_PROMPTS.find((p) => p.id === selectedId) ?? DEMO_PROMPTS[0]

  const pick = (demo: DemoPrompt) => {
    setSelectedId(demo.id)
    setPrompt(demo.prompt)
    setError("")
  }

  const handleGenerate = async () => {
    setError("")
    setLoading(true)
    try {
      const runId = await startPipelineRun(prompt, { forceStaticSite: true })
      try {
        sessionStorage.setItem(`orin:prompt:${runId}`, prompt)
      } catch {
        // ignore storage failures
      }
      router.push(`/run/${runId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start pipeline")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto pt-8 pb-16 px-2">
      <header className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary font-mono mb-4">
          <Sparkles className="h-3 w-3" />
          DEMO PROMPTS
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3">
          Pick a prompt that fits the free tier
        </h1>
        <p className="text-muted max-w-2xl mx-auto">
          Each demo is sized to finish in 1–2 Developer iterations and stay within Groq&apos;s daily
          token budget. Click one to drop it into the chat, edit if you like, then generate.
        </p>
      </header>

      {/* Grid of demo cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {DEMO_PROMPTS.map((demo) => {
          const isActive = demo.id === selectedId
          return (
            <motion.button
              key={demo.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => pick(demo)}
              className={`text-left rounded-2xl border p-5 transition-all backdrop-blur-md ${
                isActive
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_25px_rgba(199,255,61,0.12)]"
                  : "border-white/10 bg-surface/40 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${TAG_STYLES[demo.tag]}`}
                >
                  {demo.tag}
                </span>
                {isActive && <span className="text-primary text-xs font-mono">SELECTED</span>}
              </div>
              <h3 className="text-white font-bold text-lg mb-1">{demo.title}</h3>
              <p className="text-muted text-sm leading-snug mb-4">{demo.subtitle}</p>

              <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--terminal-gray)]">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="h-3 w-3" />~{demo.estTokens.toLocaleString()} tok
                </span>
                <span className="inline-flex items-center gap-1">
                  <Timer className="h-3 w-3" />~{demo.estSeconds}s
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Chat / prompt editor */}
      <section className="rounded-2xl border border-white/10 bg-surface/50 p-4 md:p-6 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-xs text-[var(--terminal-gray)] uppercase tracking-widest">
            Your Prompt
          </h2>
          <div className="flex items-center gap-3 text-xs font-mono text-[var(--terminal-gray)]">
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" />
              {selected.title}
            </span>
            <span>·</span>
            <span>{prompt.length.toLocaleString()} chars</span>
          </div>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to build…"
          className="min-h-[160px] bg-[#0a0a0a] border-white/10 text-white font-mono text-sm leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handleGenerate()
            }
          }}
        />

        {error && (
          <p className="mt-3 text-sm text-red-400 font-mono border border-red-500/20 bg-red-500/5 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-[var(--terminal-gray)] text-xs font-mono">
            Tip: demo prompts are safe to run. ⌘ / Ctrl + Enter to start.
          </p>
          <Button
            onClick={() => void handleGenerate()}
            disabled={loading || prompt.trim().length < 10}
            size="lg"
            className="h-12 px-8 text-base font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                Generate Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
