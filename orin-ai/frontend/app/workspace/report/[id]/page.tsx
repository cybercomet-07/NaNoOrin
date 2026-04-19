"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Code2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Network,
  Rocket,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatRelative,
  getRun,
  removeRun,
  type HistoryRun,
} from "@/lib/runHistory";
import { buildInlinedHtml } from "@/lib/inlineHtml";
import { startPipelineRun } from "@/lib/pipeline";
import { downloadZip } from "@/lib/zip";

function statusBadge(status: HistoryRun["status"]) {
  if (status === "FINALIZED") {
    return <Badge variant="success">Project Generated Successfully</Badge>;
  }
  if (status === "FAILED" || status === "PANIC") {
    return (
      <Badge variant="outline" className="border-red-500/40 text-red-400">
        Run Failed
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function languageForFile(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    tsx: "tsx",
    json: "json",
    md: "markdown",
    py: "python",
    txt: "text",
  };
  return map[ext] ?? "text";
}

/** Small visual section label shown above each report block. */
function SectionLabel({
  number,
  title,
  icon: Icon,
  description,
}: {
  number: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-widest text-primary font-mono">
            Section {number}
          </span>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        {description && (
          <p className="text-sm text-muted mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function ReportByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: runId } = use(params);
  const router = useRouter();
  const [run, setRun] = useState<HistoryRun | null | undefined>(undefined);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    const r = getRun(runId);
    setRun(r);
    if (r) {
      const preferred = ["index.html", "styles.css", "script.js", "README.md"];
      const first =
        preferred.find((p) => r.files[p]) ?? Object.keys(r.files)[0] ?? null;
      setActiveFile(first);
    }
  }, [runId]);

  const previewHtml = useMemo(() => {
    if (!run) return null;
    return buildInlinedHtml(run.files);
  }, [run]);

  const files = useMemo(() => {
    if (!run) return [] as Array<{ name: string; size: number }>;
    return Object.entries(run.files)
      .map(([name, content]) => ({ name, size: new Blob([content]).size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [run]);

  const onCopy = async (name: string) => {
    if (!run) return;
    const content = run.files[name];
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(name);
      window.setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500);
    } catch (err) {
      console.error("clipboard copy failed", err);
    }
  };

  const onDownload = (name: string) => {
    if (!run) return;
    const content = run.files[name];
    if (typeof content !== "string") return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onDownloadZip = () => {
    if (!run) return;
    const safeName =
      run.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 40) || "orin-run";
    downloadZip(`${safeName}.zip`, run.files);
  };

  const onRegenerate = async () => {
    if (!run?.prompt) return;
    setRegenerating(true);
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
      setRegenerating(false);
    }
  };

  const onDelete = () => {
    if (!run) return;
    if (!window.confirm("Delete this run from history?")) return;
    removeRun(run.runId);
    router.push("/workspace/history");
  };

  if (run === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-16 text-center text-white/60">
        Loading report…
      </div>
    );
  }

  if (run === null) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <Card className="bg-surface/30 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Run not found</CardTitle>
            <CardDescription>
              We couldn&apos;t find a run with id{" "}
              <span className="font-mono text-white/70">{runId}</span> in your
              history. It may have been deleted, or it was generated in a
              different browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Link href="/workspace/history">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to History
                </Button>
              </Link>
              <Link href="/workspace/demo">
                <Button>Start a new run</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const activeContent = activeFile ? run.files[activeFile] ?? "" : "";

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-10 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface/30 p-8 rounded-2xl border border-white/5 backdrop-blur-md shadow-lg shadow-black/20">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Link
              href="/workspace/history"
              className="text-xs text-white/50 hover:text-white/80 inline-flex items-center"
            >
              <ArrowLeft className="h-3 w-3 mr-1" /> History
            </Link>
            <span className="text-white/30">/</span>
            <span className="font-mono text-xs text-white/50 truncate max-w-[240px]">
              {run.runId}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-primary/40 text-primary">
              Project Report
            </Badge>
            {statusBadge(run.status)}
          </div>
          <h1 className="text-3xl font-bold text-white mt-3 truncate">
            {run.title}
          </h1>
          <p className="text-muted mt-2 text-lg line-clamp-2">{run.prompt}</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Button variant="outline" className="h-11" onClick={onDownloadZip}>
            <Download className="mr-2 h-4 w-4" /> Download .zip
          </Button>
          <Button
            className="h-11 shadow-[0_0_20px_rgba(199,255,61,0.2)]"
            onClick={onRegenerate}
            disabled={!run.prompt || regenerating}
          >
            <Rocket className="mr-2 h-4 w-4" />
            {regenerating ? "Starting…" : "Regenerate"}
          </Button>
          <Link href={`/run/${run.runId}`}>
            <Button variant="outline" className="h-11">
              <ExternalLink className="mr-2 h-4 w-4" /> Open Run
            </Button>
          </Link>
        </div>
      </div>

      {/* SECTION 1 — PROJECT SUMMARY */}
      <section>
        <SectionLabel
          number="1"
          title="Project Summary"
          icon={Sparkles}
          description="A quick overview of this run."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
              <CardTitle
                className={`text-2xl font-bold ${
                  run.status === "FINALIZED"
                    ? "text-primary"
                    : run.status === "FAILED" || run.status === "PANIC"
                      ? "text-red-400"
                      : "text-white"
                }`}
              >
                {run.status === "FINALIZED"
                  ? "Completed"
                  : run.status === "PANIC"
                    ? "Panic"
                    : run.status === "FAILED"
                      ? "Failed"
                      : "Running"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted">
                {formatRelative(run.finishedAt)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Elapsed</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {(run.elapsedMs / 1000).toFixed(1)}s
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> End-to-end
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Files</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {files.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted inline-flex items-center gap-1">
                <FileText className="h-3 w-3" /> {humanBytes(totalBytes)} total
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>Pipeline</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {run.staticSite ? "Static Site" : "Full Pipeline"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted">
                {run.staticSite ? "Fast lane" : "LangGraph agents"}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* SECTION 2 — ORIGINAL PROMPT */}
      <section>
        <SectionLabel
          number="2"
          title="Original Prompt"
          icon={FileText}
          description="What you asked Orin AI to build."
        />
        <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap font-mono text-sm text-white/90 bg-[#0a0a0a] border border-white/10 rounded-lg p-4 leading-relaxed">
              {run.prompt || "(no prompt stored)"}
            </pre>
            <div className="flex items-center gap-3 mt-3 text-xs text-white/50">
              <span>{run.prompt.length} chars</span>
              <span>•</span>
              <span className="font-mono">category: {run.category}</span>
              <span>•</span>
              <span className="font-mono">
                run id: {run.runId.slice(0, 8)}…
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECTION 3 — ARCHITECTURE */}
      <section>
        <SectionLabel
          number="3"
          title="Architecture"
          icon={Network}
          description={
            run.staticSite
              ? "This run used the static-site fast lane."
              : "This run used the full LangGraph multi-agent pipeline."
          }
        />
        <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
          <CardContent className="pt-6">
            {run.staticSite ? <FastLaneArch /> : <FullPipelineArch />}
          </CardContent>
        </Card>
      </section>

      {/* SECTION 4 — LIVE PREVIEW */}
      <section>
        <SectionLabel
          number="4"
          title="Live Preview"
          icon={Cpu}
          description="The generated site, rendered in a sandboxed iframe."
        />
        <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">index.html</CardTitle>
            {previewHtml && (
              <span className="text-xs text-muted font-mono">
                inlined CSS + JS · sandboxed
              </span>
            )}
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="rounded-lg border border-white/10 overflow-hidden bg-white">
                <iframe
                  srcDoc={previewHtml}
                  title={`${run.title} preview`}
                  className="w-full h-[520px] bg-white"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 p-10 text-center text-white/60 bg-surface/30">
                No renderable <span className="font-mono">index.html</span> was
                produced for this run.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* SECTION 5 — GENERATED CODE */}
      <section>
        <SectionLabel
          number="5"
          title="Generated Code"
          icon={Code2}
          description="All files produced by this run. Click a file to inspect it."
        />

        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm self-start">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Files</CardTitle>
              <span className="text-xs text-muted">{files.length}</span>
            </CardHeader>
            <CardContent className="p-0">
              {files.length === 0 ? (
                <div className="p-6 text-sm text-white/60">
                  No files were generated.
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {files.map((f) => {
                    const active = f.name === activeFile;
                    return (
                      <li key={f.name}>
                        <button
                          type="button"
                          onClick={() => setActiveFile(f.name)}
                          className={`w-full text-left px-5 py-3 flex items-center justify-between gap-3 transition-colors ${
                            active ? "bg-primary/10" : "hover:bg-white/5"
                          }`}
                        >
                          <span
                            className={`font-mono text-sm truncate ${
                              active ? "text-primary" : "text-white/90"
                            }`}
                          >
                            {f.name}
                          </span>
                          <span className="text-[11px] text-white/40 shrink-0">
                            {humanBytes(f.size)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-mono text-base">
                  {activeFile ?? "(no file selected)"}
                </CardTitle>
                {activeFile && (
                  <CardDescription>
                    {languageForFile(activeFile)} ·{" "}
                    {humanBytes(new Blob([activeContent]).size)}
                  </CardDescription>
                )}
              </div>
              {activeFile && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopy(activeFile)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copied === activeFile ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(activeFile)}
                  >
                    <Download className="h-4 w-4 mr-2" /> File
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <pre className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 overflow-auto max-h-[520px] text-xs text-white/90 font-mono leading-relaxed">
                <code>{activeContent || "(empty file)"}</code>
              </pre>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="w-full sm:w-auto justify-start"
            onClick={onDownloadZip}
          >
            <Download className="mr-2 h-4 w-4" /> Download complete project
            (.zip)
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto justify-start border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-300"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete from history
          </Button>
        </div>
      </section>
    </div>
  );
}

/** Visual flow diagram for the static-site fast lane path. */
function FastLaneArch() {
  const steps = [
    { label: "User Prompt", sub: "Demo Prompts / Workspace" },
    { label: "Fast-lane Detector", sub: "force_static_site = true" },
    { label: "Developer Agent", sub: "OpenAI gpt-4o-mini" },
    { label: "Static Files", sub: "index.html · styles.css · script.js" },
    { label: "Live Preview", sub: "inlined, sandboxed iframe" },
  ];
  return <FlowDiagram steps={steps} />;
}

/** Visual flow diagram for the full LangGraph pipeline path. */
function FullPipelineArch() {
  const steps = [
    { label: "User Prompt", sub: "Workspace" },
    { label: "Supervisor", sub: "routes to agents" },
    { label: "Architect", sub: "OpenRouter · DeepSeek" },
    { label: "Developer", sub: "OpenAI gpt-4o-mini" },
    { label: "Critic + Auditor", sub: "tests · sandbox" },
    { label: "Final Project", sub: "files + live preview" },
  ];
  return <FlowDiagram steps={steps} />;
}

function FlowDiagram({
  steps,
}: {
  steps: Array<{ label: string; sub: string }>;
}) {
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-3">
          <div className="min-w-[160px] rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 shadow-inner">
            <div className="text-[11px] uppercase tracking-wider text-primary/80 font-mono">
              Step {i + 1}
            </div>
            <div className="text-sm font-semibold text-white">{step.label}</div>
            <div className="text-[11px] text-white/60 mt-0.5">{step.sub}</div>
          </div>
          {i < steps.length - 1 && (
            <span className="text-primary/70 font-mono text-lg select-none">
              &rarr;
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
