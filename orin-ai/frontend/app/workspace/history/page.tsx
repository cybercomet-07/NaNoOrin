"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Rocket,
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

function StatusBadge({ status }: { status: HistoryRun["status"] }) {
  if (status === "FINALIZED") {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === "FAILED" || status === "PANIC") {
    return <Badge variant="outline" className="border-red-500/40 text-red-400">Failed</Badge>;
  }
  return <Badge variant="outline">Running</Badge>;
}

export default function HistoryPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [query, setQuery] = useState("");
  const [, forceTick] = useState(0);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRuns(listRuns());
    forceTick((n) => n + 1);
  }, []);

  useEffect(() => {
    refresh();
    // Refresh when the tab regains focus / another tab wrote to localStorage.
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === "orin.runs.v1") refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    // Relative-time refresher.
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
    refresh();
  };

  const onClearAll = () => {
    if (runs.length === 0) return;
    if (!window.confirm(`Delete all ${runs.length} run${runs.length === 1 ? "" : "s"} from history?`)) {
      return;
    }
    clearAllRuns();
    refresh();
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Workspace History</h1>
        <p className="text-muted text-lg">
          Review and manage your previously generated projects.
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
            No runs match <span className="font-mono">&ldquo;{query}&rdquo;</span>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((run) => (
            <Card
              key={run.runId}
              className="bg-surface/30 backdrop-blur-md border-white/5 hover:border-primary/20 hover:bg-surface/40 transition-all shadow-lg shadow-black/20"
            >
              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={run.status} />
                  <Link href={`/workspace/report/${run.runId}`}>
                    <Button variant="secondary" size="sm" className="hidden sm:flex">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Report
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
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
