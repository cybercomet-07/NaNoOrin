"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Network,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DIAGRAM_KINDS,
  generateDiagram,
  type DiagramKind,
} from "@/lib/diagram";

const MermaidDiagram = dynamic(() => import("@/components/MermaidDiagram"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-white/10 bg-[#0a0a0a] text-sm text-white/50">
      Loading renderer…
    </div>
  ),
});

const DEFAULT_PROMPT =
  "A todo SaaS. React frontend on Vercel talks to a FastAPI backend on Fly.io. " +
  "Auth via JWT issued from the backend. Data persists in PostgreSQL (Neon). " +
  "Redis for rate-limiting. Stripe webhooks create subscriptions.";

const PROMPT_STORAGE_KEY = "orin:architecture:lastPrompt";
const SOURCE_STORAGE_KEY = "orin:architecture:lastSource";
const KIND_STORAGE_KEY = "orin:architecture:lastKind";

export default function ArchitecturePage() {
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [kind, setKind] = useState<DiagramKind>("architecture");
  const [mermaidSource, setMermaidSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Hydrate last session from localStorage.
  useEffect(() => {
    try {
      const p = localStorage.getItem(PROMPT_STORAGE_KEY);
      const s = localStorage.getItem(SOURCE_STORAGE_KEY);
      const k = localStorage.getItem(KIND_STORAGE_KEY) as DiagramKind | null;
      if (p) setPrompt(p);
      if (s) setMermaidSource(s);
      if (k) setKind(k);
    } catch {
      // ignore
    }
  }, []);

  // Persist prompt + source + kind for a seamless second visit.
  useEffect(() => {
    try {
      localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
    } catch {
      // ignore
    }
  }, [prompt]);

  useEffect(() => {
    try {
      localStorage.setItem(SOURCE_STORAGE_KEY, mermaidSource);
    } catch {
      // ignore
    }
  }, [mermaidSource]);

  useEffect(() => {
    try {
      localStorage.setItem(KIND_STORAGE_KEY, kind);
    } catch {
      // ignore
    }
  }, [kind]);

  const handleGenerate = useCallback(async () => {
    if (prompt.trim().length < 5) {
      setError("Please describe the system in a few more words.");
      return;
    }
    setError("");
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await generateDiagram(prompt, kind, controller.signal);
      setMermaidSource(res.mermaid);
      setModel(res.model);
      setFallbackUsed(res.fallback_used);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [prompt, kind]);

  const handleCopy = useCallback(async () => {
    if (!mermaidSource) return;
    try {
      await navigator.clipboard.writeText(mermaidSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard unavailable in this browser.");
    }
  }, [mermaidSource]);

  const handleDownload = useCallback(() => {
    if (!mermaidSource) return;
    const blob = new Blob([mermaidSource], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orin-${kind}-diagram.mmd`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [mermaidSource, kind]);

  return (
    <div className="mx-auto max-w-7xl px-2 pt-8 pb-16">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          <Network className="h-3 w-3" />
          ARCHITECTURE STUDIO
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Turn an idea into a diagram
            </h1>
            <p className="max-w-2xl text-muted">
              Describe your system in plain English. Our AI (DeepSeek via
              OpenRouter) writes Mermaid and we render it live — edit, copy,
              or export.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[var(--terminal-gray)]">
            <Sparkles className="h-3 w-3 text-primary" />
            Extension · free-tier friendly
          </div>
        </div>
      </header>

      {/* Controls row */}
      <section className="mb-4 rounded-2xl border border-white/10 bg-surface/50 p-4 backdrop-blur-md md:p-5">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)]">
              Diagram type
            </label>
            <div className="flex flex-wrap gap-2">
              {DIAGRAM_KINDS.map((k) => {
                const active = k.value === kind;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    title={k.hint}
                    className={
                      "rounded-full border px-3 py-1 font-mono text-xs transition-all " +
                      (active
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-white/10 bg-transparent text-muted hover:border-white/20 hover:text-white")
                    }
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={loading || prompt.trim().length < 5}
            size="lg"
            className="h-11 px-6 font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : mermaidSource ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate Diagram
              </>
            )}
          </Button>
        </div>

        <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)]">
          Describe your system
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A real-time chat app with a React frontend, a Node.js websocket server, Redis pub/sub, and PostgreSQL for message history…"
          className="min-h-[100px] border-white/10 bg-[#0a0a0a] font-mono text-sm leading-relaxed text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleGenerate();
            }
          }}
        />

        {error && (
          <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-sm text-red-400">
            {error}
          </p>
        )}

        {model && !error && (
          <p className="mt-2 font-mono text-[11px] text-[var(--terminal-gray)]">
            Generated by <span className="text-primary/80">{model}</span>
            {fallbackUsed && (
              <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                fallback model used
              </span>
            )}
            <span className="ml-2 opacity-60">· ⌘/Ctrl + Enter to regenerate</span>
          </p>
        )}
      </section>

      {/* Split view: source (left) + rendered diagram (right) */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
      >
        <div className="flex flex-col rounded-2xl border border-white/10 bg-surface/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)]">
              Mermaid source · editable
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!mermaidSource}
                onClick={() => void handleCopy()}
                className="h-7 gap-1 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!mermaidSource}
                onClick={handleDownload}
                className="h-7 gap-1 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                .mmd
              </Button>
            </div>
          </div>
          <textarea
            value={mermaidSource}
            onChange={(e) => setMermaidSource(e.target.value)}
            placeholder="// The generated Mermaid source will appear here.\n// Edit it freely — the diagram on the right re-renders as you type."
            spellCheck={false}
            className="min-h-[420px] flex-1 resize-y border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/30"
          />
        </div>

        <div className="min-h-[420px] lg:min-h-[540px]">
          <MermaidDiagram source={mermaidSource} idPrefix="arch" />
        </div>
      </motion.section>
    </div>
  );
}
