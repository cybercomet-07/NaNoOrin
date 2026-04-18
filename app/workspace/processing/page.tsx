"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { usePipelineStream, AgentEvent, AgentStatus } from "@/hooks/usePipelineStream";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText, AlertCircle } from "lucide-react";

/* ─── Left Panel: Agent Status Cards ─── */
function AgentFeed({ agentStatuses }: { agentStatuses: Record<string, AgentStatus> }) {
  const statusColors: Record<string, string> = {
    PENDING: "text-gray-500",
    RUNNING: "text-yellow-400",
    PASSED: "text-green-400",
    FAILED: "text-red-400",
  };

  const agents = Object.values(agentStatuses);

  return (
    <Card className="h-full bg-surface/50 border-white/5 flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>Agent Feed</span>
          <Badge variant="outline">{agents.length} Agents</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 relative z-10">
        {agents.map((agent) => (
          <div key={agent.name} className="border border-zinc-800 rounded p-3 mb-2 bg-zinc-950">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-zinc-300">{agent.name}</span>
              <span className={`text-xs font-bold ${statusColors[agent.status] || "text-white"}`}>
                {agent.status}
              </span>
            </div>
            {agent.iteration > 0 && (
              <div className="text-xs text-zinc-600 mt-1">Retry #{agent.iteration}</div>
            )}
            {agent.lastOutput && (
              <div className="text-xs text-zinc-500 mt-2 border-t border-white/5 pt-2 italic truncate">
                {agent.lastOutput}
              </div>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <div className="text-center text-muted py-8 text-sm">
            Waiting for pipeline to commence...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Center Panel: Terminal / Event Log ─── */
function TerminalPanel({ events }: { events: AgentEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const formatEvent = (ev: AgentEvent): string => {
    const ts = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "";
    switch (ev.event_type) {
      case "agent_start":
        return `[${ts}] ▶ ${ev.agent} started (iteration ${ev.iteration})`;
      case "agent_complete":
        return `[${ts}] ✓ ${ev.agent} completed`;
      case "test_result":
        const passed = ev.payload?.passed ? "PASS" : "FAIL";
        return `[${ts}] 🧪 Test ${passed} — ${ev.agent} (iteration ${ev.iteration})`;
      case "status_update":
        return `[${ts}] ⚡ Status → ${ev.payload?.status}`;
      default:
        return `[${ts}] ${JSON.stringify(ev)}`;
    }
  };

  return (
    <Card className="h-full bg-[#0a0a0a] border-white/5 flex flex-col rounded-md shadow-2xl relative">
      {/* macOS-style terminal header */}
      <div className="py-3 px-4 bg-white/5 border-b border-white/5 rounded-t-md relative z-10 flex items-center justify-between">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-xs text-muted font-mono">bash — orin_pipeline</div>
      </div>
      <CardContent
        className="flex-1 p-4 font-mono text-xs md:text-sm text-green-400 overflow-y-auto whitespace-pre-wrap relative z-10"
        ref={scrollRef}
      >
        {events.length > 0
          ? events.map((ev, i) => <div key={i}>{formatEvent(ev)}</div>)
          : "Connecting to secure OrinAI environment...\n> "}
      </CardContent>
    </Card>
  );
}

/* ─── Right Panel: Output Artifacts ─── */
function ArtifactPanel({
  status,
  codeFiles,
}: {
  status: string;
  codeFiles: Record<string, string>;
}) {
  const fileNames = Object.keys(codeFiles);

  return (
    <Card className="h-full bg-surface/50 border-white/5 flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Output Artifacts</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 flex-1 overflow-y-auto">
        {status === "FINALIZED" ? (
          <div className="space-y-4">
            <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 text-center">
              <div className="text-primary font-bold mb-2">Project Generation Complete</div>
              <Badge variant="default" className="text-black bg-primary">
                {fileNames.length} Files Ready
              </Badge>
            </div>

            {/* File listing */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fileNames.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 p-2 rounded-md bg-background border border-white/5 text-xs font-mono text-zinc-300"
                >
                  <FileText className="w-3 h-3 text-primary shrink-0" />
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download .zip Payload
              </Button>
              <Button className="w-full">View Complete Report</Button>
            </div>
          </div>
        ) : status === "FAILED" ? (
          <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <div className="text-red-500 font-bold mb-2">Pipeline Terminated</div>
            <div className="text-xs text-muted">
              A critical failure occurred during multi-agent synchronization. Check the terminal
              logs.
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 opacity-50 mt-12 bg-black/40 rounded-lg border border-white/5">
            <Loader2 className="w-8 h-8 animate-spin text-muted mb-4" />
            <div className="text-sm font-medium text-white">Aggregating Artifacts...</div>
            <div className="text-xs text-muted mt-1">Files will populate post-compilation.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Dashboard ─── */
function ProcessingDashboard() {
  const searchParams = useSearchParams();
  const runId =
    searchParams?.get("runId") || "demo-run-" + Math.floor(Math.random() * 1000);
  const { events, status, agentStatuses, codeFiles, error } =
    usePipelineStream(runId);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 flex flex-col">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-2">
            Live Pipeline Telemetry
          </h1>
          <p className="text-sm text-muted flex items-center flex-wrap gap-2">
            <span>
              Stream ID:{" "}
              <span className="font-mono text-primary font-medium">{runId}</span>
            </span>
            <Badge
              variant="outline"
              className={`opacity-80 ${
                status === "RUNNING" ? "border-primary/50 text-primary" : ""
              }`}
            >
              Status: {status}
            </Badge>
          </p>
        </div>
        {error && (
          <div className="text-xs text-yellow-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)] lg:h-[calc(100vh-140px)] min-h-[600px]">
        <AgentFeed agentStatuses={agentStatuses} />
        <TerminalPanel events={events} />
        <ArtifactPanel status={status} codeFiles={codeFiles} />
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-primary" />
        </div>
      }
    >
      <ProcessingDashboard />
    </Suspense>
  );
}
