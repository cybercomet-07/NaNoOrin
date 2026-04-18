"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Bot, Code, Cpu, LineChart, Lock, Loader2, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const EXAMPLE_PROMPTS = [
  "Build a FastAPI REST API for a task manager with JWT auth, PostgreSQL, and pytest tests",
  "Build a Python service using fastchroma for vector search with semantic similarity",
  "Build a real-time chat API with WebSockets, user rooms, and message history",
];

export default function LandingPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const startPipeline = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      setError("Prompt must be at least 10 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to start pipeline");
        } else {
          const text = await res.text();
          throw new Error(`Server Error (${res.status}): ${text.slice(0, 50)}...`);
        }
      }

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const { run_id } = await res.json();
        router.push(`/run/${run_id}`);
      } else {
        throw new Error("Invalid response from server (Expected JSON)");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30 selection:text-white">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <Navbar />

      <main className="relative z-10">
        {/* HERO + PROMPT SECTION */}
        <section className="container mx-auto px-4 md:px-6 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex flex-col gap-6"
            >
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary font-medium w-fit">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
                OrinAI v2.0 is live
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                One Prompt. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  No Human in the Loop.
                </span> <br />
                Working Code.
              </h1>
              
              <p className="text-lg md:text-xl text-muted max-w-xl">
                OrinAI deploys intelligent AI agents that research, architect, code, test, and audit your entire project — autonomously.
              </p>

              <div className="flex items-center gap-6 mt-4 text-sm text-muted font-medium">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Under 10 Minutes
                </div>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" /> Multi-Agent Powered
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> Secure & Audited
                </div>
              </div>
            </motion.div>

            {/* RIGHT: PROMPT INPUT */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 blur-xl" />
              <div className="relative rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur-md shadow-2xl shadow-black flex flex-col gap-4">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-1">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-muted font-mono ml-2">orin — prompt_engine</span>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to build..."
                  rows={5}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-4 
                             text-white font-mono text-sm resize-none
                             focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30
                             placeholder:text-zinc-600 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startPipeline();
                  }}
                />

                {error && (
                  <p className="text-red-400 text-sm font-mono">⚠ {error}</p>
                )}

                <Button
                  onClick={startPipeline}
                  disabled={loading || !prompt.trim()}
                  className="w-full h-12 text-base font-bold group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Orin AI...
                    </>
                  ) : (
                    <>
                      ▶ Run Orin AI
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>

                <p className="text-zinc-600 text-xs text-center font-mono">
                  ⌘ + Enter to run
                </p>

                {/* Example Prompts */}
                <div className="border-t border-white/5 pt-4 mt-1">
                  <p className="text-zinc-600 text-xs font-mono mb-3">— example prompts —</p>
                  <div className="space-y-2">
                    {EXAMPLE_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(p)}
                        className="w-full text-left text-xs font-mono text-zinc-500 
                                   hover:text-white p-2 rounded border 
                                   border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                      >
                        › {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section id="product" className="container mx-auto px-4 md:px-6 py-24 bg-surface/30 border-y border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Complete Intelligence</h2>
            <p className="text-muted max-w-2xl mx-auto text-lg">
              End-to-end automation from raw idea to deployed infrastructure.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Market Research", icon: LineChart, desc: "Instant viable analysis of competitors, TAM, and target demographics." },
              { title: "AI Personas", icon: Bot, desc: "Synthesized synthetic users to battle-test your product before launch." },
              { title: "Architecture Builder", icon: Cpu, desc: "Scalable backend schemas and API route mapping automatically." },
              { title: "Full Code Generation", icon: Code, desc: "Production-ready React/Next.js frontend and Node backend code." },
              { title: "Security Audit", icon: ShieldCheck, desc: "Sentinel agents review code for vulnerabilities and performance bottlenecks." },
              { title: "Website Generator", icon: Zap, desc: "Instantly deploy a beautiful landing page with our dynamic templates." },
            ].map((feature, i) => (
              <Card key={i} className="bg-surface/50 hover:bg-surface border-white/5 hover:border-primary/30 transition-all group">
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">{feature.desc}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* AI AGENTS SHOWCASE */}
        <section className="container mx-auto px-4 md:px-6 py-24">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Meet OrinAI</h2>
              <p className="text-muted text-lg mb-8">
                Six specialized AI agents working synchronously to transform your text prompt into a living business.
              </p>
              <ul className="space-y-4">
                {[
                  { name: "SCOUT", role: "Market Analyst" },
                  { name: "PERSONA", role: "UX / Simulator" },
                  { name: "BLUEPRINT", role: "Systems Architect" },
                  { name: "FORGE", role: "Lead Developer" },
                  { name: "VERDICT", role: "QA Engineer" },
                  { name: "SENTINEL", role: "Security & DevOps" },
                ].map((agent, i) => (
                  <li key={i} className="flex items-center gap-4 p-3 rounded-lg border border-white/5 bg-surface/50">
                    <span className="font-mono text-primary font-bold">{agent.name}</span>
                    <span className="text-white/60 text-sm">— {agent.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 relative aspect-square max-w-md mx-auto">
              {/* Visual representation of agents connected */}
              <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-4 rounded-full border border-primary/20 animate-[spin_40s_linear_infinite_reverse]" />
              <div className="absolute inset-8 rounded-full border border-secondary/20 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-card border border-primary/50 shadow-[0_0_30px_rgba(199,255,61,0.2)] flex items-center justify-center z-10">
                  <Logo />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="container mx-auto px-4 md:px-6 py-24 bg-surface/30 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Pricing</h2>
            <p className="text-muted">Simple scalable plans for absolute power.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free */}
            <Card className="bg-surface border-white/10">
              <CardHeader>
                <CardTitle className="text-xl">Free</CardTitle>
                <div className="text-4xl font-bold text-white mt-4">$0</div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">✓ 1 Project generation/mo</li>
                  <li className="flex items-center gap-2">✓ Basic market report</li>
                  <li className="flex items-center gap-2">✓ Shared infrastructure</li>
                </ul>
                <Button variant="outline" className="w-full mt-6">Get Started</Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="bg-card border-primary relative shadow-[0_0_40px_rgba(199,255,61,0.1)] transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-black text-xs font-bold px-3 py-1 rounded-full uppercase">
                Most Popular
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Pro</CardTitle>
                <div className="text-4xl font-bold text-white mt-4">$49<span className="text-lg text-muted font-normal">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-white">
                  <li className="flex items-center gap-2 text-primary">✓ 50 Project generations/mo</li>
                  <li className="flex items-center gap-2">✓ Advanced codebase access</li>
                  <li className="flex items-center gap-2">✓ 1-Click website deployments</li>
                  <li className="flex items-center gap-2">✓ Full architectural specs</li>
                </ul>
                <Button className="w-full mt-6">Subscribe</Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card className="bg-surface border-white/10">
              <CardHeader>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="text-4xl font-bold text-white mt-4">$299<span className="text-lg text-muted font-normal">/mo</span></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-white/70">
                  <li className="flex items-center gap-2">✓ Unlimited generations</li>
                  <li className="flex items-center gap-2">✓ Custom API integrations</li>
                  <li className="flex items-center gap-2">✓ Dedicated Sentinel clusters</li>
                </ul>
                <Button variant="outline" className="w-full mt-6">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </section>

      </main>
      
      <Footer />
    </div>
  );
}
