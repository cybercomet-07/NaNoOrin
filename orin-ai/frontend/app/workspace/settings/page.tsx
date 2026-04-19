"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Cpu,
  Database,
  FileText,
  LogOut,
  Network,
  Trash2,
  User,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { clearAllRuns, listRuns } from "@/lib/runHistory";

type TabId = "account" | "about" | "data" | "danger";

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> =
  [
    { id: "account", label: "Account", icon: User },
    { id: "about", label: "About This Demo", icon: Bot },
    { id: "data", label: "Local Data", icon: Database },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

export default function SettingsPage() {
  const router = useRouter();
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [runCount, setRunCount] = useState(0);
  const [clearedNote, setClearedNote] = useState<string | null>(null);

  const refreshCounts = useCallback(() => {
    try {
      setRunCount(listRuns().length);
    } catch {
      setRunCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const handleLogout = () => {
    logout();
    router.replace("/");
  };

  const handleClearHistory = () => {
    if (runCount === 0) return;
    if (
      !window.confirm(
        `Delete all ${runCount} run${runCount === 1 ? "" : "s"} from local history?`,
      )
    ) {
      return;
    }
    clearAllRuns();
    refreshCounts();
    setClearedNote("History cleared.");
    window.setTimeout(() => setClearedNote(null), 2500);
  };

  const handleWipeEverything = () => {
    if (
      !window.confirm(
        "This wipes the local session, demo user, and all run history from this browser. Continue?",
      )
    ) {
      return;
    }
    try {
      window.localStorage.removeItem("orin.runs.v1");
      window.localStorage.removeItem("orin:users");
      window.localStorage.removeItem("orin:session");
    } catch {
      // ignore
    }
    router.replace("/");
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-muted text-lg">
          Everything here reflects the real state of this demo. No mock data.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Tab rail */}
        <div className="w-full md:w-56 space-y-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const isDanger = tab.id === "danger";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? isDanger
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "bg-surface/70 text-white border border-white/10 shadow-sm"
                    : "text-muted hover:bg-surface/40 hover:text-white"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === "account" && (
            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-lg shadow-black/20">
              <CardHeader>
                <CardTitle>Signed-in account</CardTitle>
                <CardDescription>
                  This is the account currently logged in on this browser. Auth
                  is local-only for the demo; there is no remote user database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Email</label>
                  <Input
                    value={session?.email ?? ""}
                    readOnly
                    className="font-mono cursor-not-allowed opacity-90"
                    placeholder="(not signed in)"
                  />
                </div>
                {session?.issuedAt && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">
                      Session started
                    </label>
                    <Input
                      value={new Date(session.issuedAt).toLocaleString()}
                      readOnly
                      className="font-mono cursor-not-allowed opacity-90"
                    />
                  </div>
                )}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-300"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "about" && (
            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-lg shadow-black/20">
              <CardHeader>
                <CardTitle>About this demo build</CardTitle>
                <CardDescription>
                  Accurate description of how this instance is wired. No
                  marketing copy, no fake plans.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <RealInfoRow
                  icon={Cpu}
                  label="Developer agent"
                  value="OpenAI gpt-4o-mini"
                  sub="First choice for code generation. OpenRouter DeepSeek fallback if OpenAI fails."
                />
                <RealInfoRow
                  icon={Network}
                  label="Architect agent"
                  value="OpenRouter · DeepSeek Chat v3.1"
                  sub="Also powers the Architecture page's Mermaid diagrams."
                />
                <RealInfoRow
                  icon={Bot}
                  label="In-product chatbot"
                  value="OpenRouter · DeepSeek Chat v3.1"
                  sub="The lime bubble on every page (hidden on the Run page)."
                />
                <RealInfoRow
                  icon={FileText}
                  label="Static-site fast lane"
                  value="Enabled for demo prompts"
                  sub="Single-page websites skip the full pipeline and render in ~15-30s."
                />
                <div className="pt-2 text-xs text-muted flex flex-wrap gap-2">
                  <Badge variant="outline">FastAPI</Badge>
                  <Badge variant="outline">LangGraph</Badge>
                  <Badge variant="outline">Redis</Badge>
                  <Badge variant="outline">E2B Sandbox</Badge>
                  <Badge variant="outline">Tavily</Badge>
                  <Badge variant="outline">Logfire</Badge>
                  <Badge variant="outline">Next.js 16</Badge>
                  <Badge variant="outline">React 19</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "data" && (
            <Card className="bg-surface/20 backdrop-blur-md border-white/5 shadow-lg shadow-black/20">
              <CardHeader>
                <CardTitle>Local data</CardTitle>
                <CardDescription>
                  History and report data live in this browser&apos;s
                  localStorage. Nothing here is shared with a server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-black/30 border border-white/5">
                  <div>
                    <div className="text-sm text-white font-medium">
                      Saved runs
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Appears on the History page and in Reports.
                    </div>
                  </div>
                  <span className="font-mono text-2xl text-primary">
                    {runCount}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClearHistory}
                    disabled={runCount === 0}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/5 hover:text-red-300 disabled:opacity-40"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear run history
                  </Button>
                  {clearedNote && (
                    <span className="text-xs text-primary">{clearedNote}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "danger" && (
            <Card className="bg-red-500/5 backdrop-blur-md border-red-500/20 shadow-lg shadow-black/20">
              <CardHeader>
                <CardTitle className="text-red-400">Danger zone</CardTitle>
                <CardDescription>
                  These actions only affect this browser&apos;s local demo
                  state. There is no remote account to delete.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-black/40 border border-white/5">
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      Sign out of this browser
                    </h4>
                    <p className="text-xs text-muted mt-1">
                      Returns you to the landing page. Your run history stays
                      intact for next time.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      Wipe everything local
                    </h4>
                    <p className="text-xs text-muted mt-1">
                      Removes the session, the local demo user, and all run
                      history from this browser. The demo account will be
                      re-seeded automatically on the next login page visit.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="text-red-400 hover:bg-red-500/10 border-red-500/30"
                    onClick={handleWipeEverything}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Wipe local data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RealInfoRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-white/50 font-mono">
          {label}
        </div>
        <div className="text-sm text-white font-medium">{value}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
