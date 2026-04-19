"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  clearAllRuns,
  formatRelative,
  listRuns,
  removeRun,
  type HistoryRun,
} from "@/lib/runHistory";
import { startPipelineRun } from "@/lib/pipeline";
import { downloadZip } from "@/lib/zip";

function StatusBadge({ status }: { status: HistoryRun["status"] }) {
  if (status === "FINALIZED") {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === "FAILED" || status === "PANIC") {
    return (
      <Badge variant="outline" className="border-red-500/40 text-red-400">
        Failed
      </Badge>
    );
  }
  return <Badge variant="outline">Running</Badge>;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [query, setQuery] = useState("");
  const [, forceTick] = useState(0);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRuns(listRuns());
    forceTick((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "orin.runs.v1") refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(t);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.prompt.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q),
    );
  }, [runs, query]);

  const onRegenerate = async (run: HistoryRun) => {
    if (!run.prompt) return;
    setRegenerating(run.runId);
    try {
      const newRunId = await startPipelineRun(run.prompt, {
        forceStaticSite: run.staticSite,
      });
      try {
        sessionStorage.setItem(`orin:prompt:${newRunId}`, run.prompt);
      } catch {
        // ignore
      }
      router.push(`/run/${newRunId}`);
    } catch (err) {
      console.error("regenerate failed", err);
      setRegenerating(null);
    }
  };

  const onDelete = (runId: string) => {
    removeRun(runId);
    if (expanded === runId) setExpanded(null);
    refresh();
  };

  const onClearAll = () => {
    if (runs.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${runs.length} run${runs.length === 1 ? "" : "s"} from history?`,
      )
    ) {
      return;
    }
    clearAllRuns();
    setExpanded(null);
    refresh();
  };

  const onDownloadZip = (run: HistoryRun) => {
    const name = `${run.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40) || "orin-run"}.zip`;
    downloadZip(name, run.files);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Workspace History</h1>
        <p className="text-muted text-lg">
          Review your previous runs — click a row to see the prompt and the
          generated code.
          {runs.length > 0 && (
            <span className="text-white/50">
              {" "}
              · {runs.length} run{runs.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            placeholder="Search projects…"
            className="pl-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
        {runs.length > 0 && (
          <Button
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-300"
            onClick={onClearAll}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear All
          </Button>
        )}
      </div>

      {runs.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface/30 p-10 text-center">
          <p className="text-white/70">
            No runs match{" "}
            <span className="font-mono">&ldquo;{query}&rdquo;</span>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((run) => {
            const isOpen = expanded === run.runId;
            return (
              <Card
                key={run.runId}
                className="bg-surface/30 backdrop-blur-md border-white/5 hover:border-primary/20 transition-all shadow-lg shadow-black/20"
              >
                <CardContent className="p-0">
                  {/* Row summary (always visible) */}
                  <div
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() =>
                      setExpanded((id) => (id === run.runId ? null : run.runId))
                    }
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center border border-white/5 shrink-0">
                        <span className="text-xl font-bold text-white/50">
                          {run.title.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {run.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted flex-wrap">
                          <span>{formatRelative(run.finishedAt)}</span>
                          <span className="text-muted">•</span>
                          <span>{run.category}</span>
                          <span className="text-muted">•</span>
                          <span className="font-mono text-xs">
                            {Object.keys(run.files).length} file
                            {Object.keys(run.files).length === 1 ? "" : "s"}
                          </span>
                          <span className="text-muted">•</span>
                          <span className="font-mono text-xs">
                            {(run.elapsedMs / 1000).toFixed(0)}s
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0 flex-wrap justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <StatusBadge status={run.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpanded((id) =>
                            id === run.runId ? null : run.runId,
                          )
                        }
                      >
                        {isOpen ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" /> Hide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" /> View
                          </>
                        )}
                      </Button>
                      <Link href={`/workspace/report/${run.runId}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="hidden sm:inline-flex"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Report
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!run.prompt || regenerating === run.runId}
                        onClick={() => onRegenerate(run)}
                      >
                        {regenerating === run.runId ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Starting…
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4 mr-2" />
                            Regenerate
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => onDelete(run.runId)}
                        title="Delete from history"
                        className="p-2 rounded-md text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <ExpandedRunPanel
                      run={run}
                      onDownloadZip={() => onDownloadZip(run)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExpandedRunPanel({
  run,
  onDownloadZip,
}: {
  run: HistoryRun;
  onDownloadZip: () => void;
}) {
  const fileNames = Object.keys(run.files);
  const preferred = ["index.html", "styles.css", "script.js", "README.md"];
  const defaultFile =
    preferred.find((p) => run.files[p]) ?? fileNames[0] ?? null;
  const [active, setActive] = useState<string | null>(defaultFile);
  const [copied, setCopied] = useState(false);

  const activeContent = active ? run.files[active] ?? "" : "";

  const onCopy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("copy failed", err);
    }
  };

  const onDownloadFile = () => {
    if (!active) return;
    const blob = new Blob([activeContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = active;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="border-t border-white/5 bg-[#050505]/40 p-6 space-y-6"
      onClick={(e) => e.stopPropagation()}
    >
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs uppercase tracking-widest text-white/50 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> User Prompt
          </h4>
          <span className="text-[11px] text-white/30">
            {run.prompt.length} chars · {run.staticSite ? "Static Site" : "Full Pipeline"}
          </span>
        </div>
        <pre className="whitespace-pre-wrap font-mono text-[12.5px] text-white/90 bg-[#0a0a0a] border border-white/10 rounded-lg p-4 leading-relaxed max-h-52 overflow-y-auto">
          {run.prompt || "(no prompt stored)"}
        </pre>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs uppercase tracking-widest text-white/50 flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5" /> Generated Code
            <span className="text-white/30 normal-case tracking-normal">
              · {fileNames.length} file{fileNames.length === 1 ? "" : "s"}
            </span>
          </h4>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDownloadZip}>
              <Download className="h-4 w-4 mr-2" /> Download .zip
            </Button>
          </div>
        </div>

        {fileNames.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#0a0a0a] p-6 text-center text-white/60 text-sm">
            This run produced no files.
          </div>
        ) : (
          <div className="grid md:grid-cols-[220px_minmax(0,1fr)] gap-4">
            <ul className="rounded-lg border border-white/10 bg-[#0a0a0a] overflow-hidden divide-y divide-white/5 self-start max-h-80 overflow-y-auto">
              {fileNames.map((name) => {
                const size = new Blob([run.files[name] ?? ""]).size;
                const isActive = name === active;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => setActive(name)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`font-mono text-xs truncate ${
                          isActive ? "text-primary" : "text-white/80"
                        }`}
                      >
                        {name}
                      </span>
                      <span className="text-[10px] text-white/40 shrink-0">
                        {humanBytes(size)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-lg border border-white/10 bg-[#0a0a0a] overflow-hidden flex flex-col min-w-0">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 bg-black/40">
                <span className="font-mono text-xs text-white/80 truncate">
                  {active ?? "(no file selected)"}
                </span>
                {active && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={onCopy}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onDownloadFile}>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      File
                    </Button>
                  </div>
                )}
              </div>
              <pre className="overflow-auto max-h-80 text-[12px] leading-relaxed font-mono text-white/90 p-4">
                <code>{activeContent || "(empty file)"}</code>
              </pre>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/30 backdrop-blur-md p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border border-primary/30 mb-4">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">No runs yet</h2>
      <p className="text-muted max-w-md mx-auto mb-6">
        Your generated projects will show up here. Pick a demo prompt to get a
        small single-page website ready in about a minute.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/workspace/demo">
          <Button>
            <Sparkles className="mr-2 h-4 w-4" />
            Browse Demo Prompts
          </Button>
        </Link>
        <Link href="/workspace">
          <Button variant="outline">Open New Run</Button>
        </Link>
      </div>
    </div>
  );
}
