"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  FileSearch,
  FileText,
  GitBranch,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeProject,
  extractScoreLine,
  type AnalyzeResponse,
} from "@/lib/analyze";

type Mode = "repo" | "text";

const URL_STORAGE_KEY = "orin:analyze:lastUrl";
const TEXT_STORAGE_KEY = "orin:analyze:lastText";
const MODE_STORAGE_KEY = "orin:analyze:lastMode";
const REPORT_STORAGE_KEY = "orin:analyze:lastReport";

const SAMPLE_URL = "https://github.com/vercel/next.js";

export default function AnalyzePage() {
  const [mode, setMode] = useState<Mode>("repo");
  const [repoUrl, setRepoUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem(URL_STORAGE_KEY);
      const t = localStorage.getItem(TEXT_STORAGE_KEY);
      const m = localStorage.getItem(MODE_STORAGE_KEY) as Mode | null;
      const rRaw = localStorage.getItem(REPORT_STORAGE_KEY);
      if (u) setRepoUrl(u);
      if (t) setText(t);
      if (m === "repo" || m === "text") setMode(m);
      if (rRaw) {
        try {
          const parsed = JSON.parse(rRaw) as AnalyzeResponse;
          if (parsed && typeof parsed.report_markdown === "string") {
            setResult(parsed);
          }
        } catch {
          // ignore bad cache
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(URL_STORAGE_KEY, repoUrl);
    } catch {
      // ignore
    }
  }, [repoUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(TEXT_STORAGE_KEY, text);
    } catch {
      // ignore
    }
  }, [text]);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    try {
      if (result) {
        localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(result));
      }
    } catch {
      // ignore — result might be too large for localStorage in rare cases
    }
  }, [result]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (mode === "repo") return repoUrl.trim().length >= 10;
    return text.trim().length >= 40;
  }, [mode, repoUrl, text, loading]);

  const handleAnalyze = useCallback(async () => {
    setError("");
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await analyzeProject(
        mode === "repo"
          ? { repoUrl: repoUrl.trim() }
          : { text: text.trim() },
        controller.signal,
      );
      setResult(res);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [mode, repoUrl, text]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.report_markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Clipboard unavailable in this browser.");
    }
  }, [result]);

  const handleDownloadMd = useCallback(() => {
    if (!result) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const base =
      (result.source.repo_name ?? result.source.label)
        .replace(/[^a-zA-Z0-9-_]+/g, "_")
        .slice(0, 40) || "orin-analysis";
    const filename = `${base}-report-${stamp}.md`;
    const header = buildMarkdownHeader(result);
    const body = `${header}\n\n${result.report_markdown.trim()}\n`;
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleDownloadTxt = useCallback(() => {
    if (!result) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const base =
      (result.source.repo_name ?? result.source.label)
        .replace(/[^a-zA-Z0-9-_]+/g, "_")
        .slice(0, 40) || "orin-analysis";
    const filename = `${base}-report-${stamp}.txt`;
    const stripped = stripMarkdown(result.report_markdown);
    const header = buildTextHeader(result);
    const blob = new Blob([`${header}\n\n${stripped}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const scoreLine = result ? extractScoreLine(result.report_markdown) : null;

  return (
    <div className="mx-auto max-w-6xl px-2 pt-8 pb-16">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          <FileSearch className="h-3 w-3" />
          REPO ANALYZER
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Analyze a repo or a plan
            </h1>
            <p className="max-w-2xl text-muted">
              Paste a public GitHub URL, a README, or a plan document. Gemini
              reads the context and returns a labeled project report you can
              download as Markdown or plain text.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[var(--terminal-gray)]">
            <Sparkles className="h-3 w-3 text-primary" />
            Extension · powered by Gemini
          </div>
        </div>
      </header>

      {/* INPUT */}
      <section className="mb-4 rounded-2xl border border-white/10 bg-surface/50 p-4 backdrop-blur-md md:p-5">
        <div className="mb-4 flex items-center gap-2">
          <ModeToggle
            active={mode === "repo"}
            onClick={() => setMode("repo")}
            icon={GitBranch}
            label="Repo URL"
          />
          <ModeToggle
            active={mode === "text"}
            onClick={() => setMode("text")}
            icon={FileText}
            label="Paste Text"
          />
        </div>

        {mode === "repo" ? (
          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)]">
              Public GitHub repository
            </label>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 border-white/10 bg-[#0a0a0a] font-mono text-sm text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (canSubmit) void handleAnalyze();
                  }
                }}
              />
              <Button
                onClick={() => void handleAnalyze()}
                disabled={!canSubmit}
                size="lg"
                className="h-11 px-6 font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing…
                  </>
                ) : result ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Analyze Repo
                  </>
                )}
              </Button>
            </div>
            <p className="font-mono text-[11px] text-[var(--terminal-gray)]">
              Public repos only. Try{" "}
              <button
                type="button"
                onClick={() => setRepoUrl(SAMPLE_URL)}
                className="underline decoration-dotted text-primary/80 hover:text-primary"
              >
                {SAMPLE_URL}
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--terminal-gray)]">
              Paste a README, plan, or spec
            </label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="# My Project\n\nA short description of what the project does…"
              className="min-h-[180px] border-white/10 bg-[#0a0a0a] font-mono text-sm leading-relaxed text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (canSubmit) void handleAnalyze();
                }
              }}
            />
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="font-mono text-[11px] text-[var(--terminal-gray)]">
                {text.trim().length} chars · ⌘/Ctrl + Enter to analyze
              </p>
              <Button
                onClick={() => void handleAnalyze()}
                disabled={!canSubmit}
                size="lg"
                className="h-11 px-6 font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing…
                  </>
                ) : result ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-analyze
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Analyze Text
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 font-mono text-sm text-red-400">
            {error}
          </p>
        )}
      </section>

      {/* REPORT */}
      {result ? (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-white/10 bg-surface/40 backdrop-blur-md"
        >
          <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                  Project Report
                </span>
                <span className="font-mono text-[11px] text-[var(--terminal-gray)]">
                  source · {result.source.kind}
                </span>
                <span className="font-mono text-[11px] text-[var(--terminal-gray)]">
                  model · {result.model}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white truncate">
                {result.source.repo_owner && result.source.repo_name
                  ? `${result.source.repo_owner}/${result.source.repo_name}`
                  : result.source.label}
              </h2>
              {scoreLine && (
                <p className="mt-1 font-mono text-sm text-primary/90">
                  {scoreLine}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCopy()}
                className="h-9"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy markdown
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTxt}
                className="h-9"
              >
                <Download className="mr-2 h-4 w-4" />
                .txt
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleDownloadMd}
                className="h-9"
              >
                <Download className="mr-2 h-4 w-4" />
                Download .md
              </Button>
            </div>
          </div>

          <div className="px-5 py-6 md:px-8">
            <article className="report-markdown text-white/90 leading-relaxed">
              <ReactMarkdown>{result.report_markdown}</ReactMarkdown>
            </article>
          </div>

          <div className="flex flex-col gap-1 border-t border-white/5 px-5 py-3 font-mono text-[11px] text-[var(--terminal-gray)] md:flex-row md:items-center md:justify-between">
            <span>
              Context sampled · {result.source.readme_chars.toLocaleString()} README chars ·{" "}
              {result.source.files_sampled} file{result.source.files_sampled === 1 ? "" : "s"}
            </span>
            <span>
              {result.source.default_branch
                ? `branch: ${result.source.default_branch}`
                : "no repository branch"}
            </span>
          </div>
        </motion.section>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/10 bg-surface/20 p-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <FileSearch className="h-5 w-5" />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-white">
            No report yet
          </h2>
          <p className="mx-auto max-w-md text-sm text-muted">
            Paste a public GitHub URL (owner/repo) above, or switch to{" "}
            <button
              type="button"
              className="underline decoration-dotted text-primary/80 hover:text-primary"
              onClick={() => setMode("text")}
            >
              Paste Text
            </button>{" "}
            to analyze a README or plan document. Gemini will produce a
            labeled report you can download.
          </p>
        </section>
      )}

      {/* Minimal markdown styling — keeps the report readable without pulling
          in tailwind typography. */}
      <style jsx global>{`
        .report-markdown h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin: 0 0 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .report-markdown h2 {
          font-size: 1.15rem;
          font-weight: 600;
          color: white;
          margin: 1.6rem 0 0.6rem;
        }
        .report-markdown h3 {
          font-size: 1rem;
          font-weight: 600;
          color: white;
          margin: 1.25rem 0 0.5rem;
        }
        .report-markdown p {
          margin: 0.5rem 0;
          color: rgba(255, 255, 255, 0.85);
        }
        .report-markdown ul,
        .report-markdown ol {
          margin: 0.5rem 0 0.75rem 1.25rem;
          padding: 0;
          color: rgba(255, 255, 255, 0.85);
        }
        .report-markdown li {
          margin: 0.2rem 0;
        }
        .report-markdown ul {
          list-style: disc;
        }
        .report-markdown ol {
          list-style: decimal;
        }
        .report-markdown strong {
          color: white;
        }
        .report-markdown code {
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 0.85em;
          color: rgb(199, 255, 61);
        }
        .report-markdown pre {
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 0.9rem 1rem;
          overflow-x: auto;
          margin: 0.75rem 0;
        }
        .report-markdown pre code {
          background: transparent;
          border: 0;
          padding: 0;
          color: rgba(255, 255, 255, 0.9);
        }
        .report-markdown a {
          color: rgb(199, 255, 61);
          text-decoration: underline;
          text-decoration-style: dotted;
        }
        .report-markdown blockquote {
          border-left: 3px solid rgba(199, 255, 61, 0.4);
          margin: 0.75rem 0;
          padding: 0.25rem 0.9rem;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(199, 255, 61, 0.04);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs transition-all " +
        (active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/10 bg-transparent text-muted hover:border-white/20 hover:text-white")
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function buildMarkdownHeader(res: AnalyzeResponse): string {
  const when = new Date().toISOString();
  const label =
    res.source.repo_owner && res.source.repo_name
      ? `${res.source.repo_owner}/${res.source.repo_name}`
      : res.source.label;
  return [
    `<!--`,
    `  Generated by Orin AI · Repo Analyzer`,
    `  Source: ${label}`,
    `  Model: ${res.model}`,
    `  Kind: ${res.source.kind}`,
    `  Generated: ${when}`,
    `-->`,
  ].join("\n");
}

function buildTextHeader(res: AnalyzeResponse): string {
  const when = new Date().toISOString();
  const label =
    res.source.repo_owner && res.source.repo_name
      ? `${res.source.repo_owner}/${res.source.repo_name}`
      : res.source.label;
  return [
    `ORIN AI · REPO ANALYZER REPORT`,
    `Source: ${label}`,
    `Model: ${res.model}`,
    `Kind: ${res.source.kind}`,
    `Generated: ${when}`,
    `----------------------------------------`,
  ].join("\n");
}

/**
 * Very small, dependency-free markdown → plain-text stripper. Not perfect,
 * but good enough for a downloadable .txt companion file.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (block) =>
      block
        .replace(/^```[^\n]*\n?/, "")
        .replace(/```$/, "")
        .trim(),
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ")
    .trim();
}
