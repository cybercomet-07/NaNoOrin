"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Bot, Code, Cpu, LineChart, Lock, ShieldCheck, Zap } from "lucide-react"
import { Logo } from "@/components/shared/Logo"
import SplitText from "@/components/SplitText"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30 selection:text-white">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <Navbar />

      <main className="relative z-10">
        {/* HERO */}
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

              <div className="flex flex-col gap-2">
                <SplitText
                  text="One Prompt."
                  tag="h1"
                  className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight"
                  textAlign="left"
                  delay={50}
                />
                <motion.h1
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                  className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary"
                >
                  No Human in the Loop.
                </motion.h1>
                <SplitText
                  text="Working Code."
                  tag="h1"
                  className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight"
                  textAlign="left"
                  delay={150}
                  from={{ opacity: 0, y: 15 }}
                />
              </div>

              <div className="mt-4">
                <SplitText
                  text="OrinAI deploys intelligent AI agents that research, architect, code, test, and audit your entire project — autonomously."
                  tag="p"
                  className="text-lg md:text-xl text-muted max-w-xl"
                  textAlign="left"
                  delay={200}
                  splitType="words"
                />
              </div>

              <div className="flex items-center gap-6 mt-2 text-sm text-muted font-medium">
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

              <div className="flex flex-wrap gap-3 mt-4">
                <Link href="/login">
                  <Button size="lg" className="h-12 px-6 text-base font-bold">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                    How It Works
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* RIGHT: Demo preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 blur-xl" />
              <div className="relative rounded-2xl border border-white/10 bg-surface/50 p-6 backdrop-blur-md shadow-2xl shadow-black flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="text-xs text-muted font-mono ml-2">orin — demo preview</span>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#0a0a0a] p-4 font-mono text-xs space-y-1">
                  <p className="text-[var(--terminal-gray)]">$ orin run</p>
                  <p className="text-[var(--terminal-yellow)]">▶ Supervisor planning…</p>
                  <p className="text-[var(--terminal-green)]">✓ Researcher complete</p>
                  <p className="text-[var(--terminal-green)]">✓ Architect complete</p>
                  <p className="text-[var(--terminal-green)]">✓ Developer complete — tests passed</p>
                  <p className="text-[var(--terminal-green)]">✓ Auditor complete</p>
                  <p className="text-primary font-bold">═══ PIPELINE FINALIZED ═══</p>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <p className="text-muted text-sm mb-3">
                    Sign in to try a curated demo prompt that finishes within free-tier token limits.
                  </p>
                  <Link href="/login?next=%2Fworkspace%2Fdemo">
                    <Button className="w-full h-11 text-base font-bold group">
                      See Demo Prompts
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 perspective-1000">
            {[
              { title: "Market Research", icon: LineChart, desc: "Instant viable analysis of competitors, TAM, and target demographics." },
              { title: "AI Personas", icon: Bot, desc: "Synthesized synthetic users to battle-test your product before launch." },
              { title: "Architecture Builder", icon: Cpu, desc: "Scalable backend schemas and API route mapping automatically." },
              { title: "Full Code Generation", icon: Code, desc: "Production-ready FastAPI backend code generated from one prompt." },
              { title: "Security Audit", icon: ShieldCheck, desc: "Sentinel agents review code for vulnerabilities and performance bottlenecks." },
              { title: "Live Test Loop", icon: Zap, desc: "E2B sandbox runs pytest on every iteration until all tests pass." },
            ].map((feature, i) => (
              <div key={i} className="isometric-card preserve-3d">
                <Card className="h-full bg-surface/50 border-white/5 brutalist-grid preserve-3d group overflow-visible">
                  <CardHeader className="preserve-3d pb-2">
                    <div className="translate-z-50 mb-4 inline-block">
                      <feature.icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <CardTitle className="translate-z-40">
                      <SplitText text={feature.title} delay={40} textAlign="left" threshold={0.2} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="preserve-3d">
                    <CardDescription className="text-sm translate-z-20">
                      {feature.desc}
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="container mx-auto px-4 md:px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-muted max-w-2xl mx-auto text-lg">
              Three steps — zero hand-holding.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                title: "Pick a demo prompt",
                desc: "Start from a curated small prompt that fits in the free-tier token budget.",
              },
              {
                step: "02",
                title: "Agents work live",
                desc: "Supervisor, Researcher, Architect, Developer, Critic, and Auditor run in parallel on your behalf.",
              },
              {
                step: "03",
                title: "Code + preview",
                desc: "Flip between PREVIEW and CODE to see the generated app and its files.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-white/10 bg-surface/40 p-6 backdrop-blur-md"
              >
                <div className="font-mono text-xs text-primary mb-3">STEP {s.step}</div>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AGENTS */}
        <section id="about" className="container mx-auto px-4 md:px-6 py-24">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Meet OrinAI</h2>
              <p className="text-muted text-lg mb-8">
                Seven specialized AI agents working together to transform your text prompt into working code.
              </p>
              <ul className="space-y-4">
                {[
                  { name: "SUPERVISOR", role: "Orchestrator & task planner" },
                  { name: "RESEARCHER", role: "Market & library research via Tavily" },
                  { name: "PERSONA", role: "Synthetic user scenarios" },
                  { name: "ARCHITECT", role: "Systems & API design" },
                  { name: "DEVELOPER", role: "Code writer + E2B test runner" },
                  { name: "CRITIC", role: "Test-result evaluator" },
                  { name: "AUDITOR", role: "Security & correctness review" },
                ].map((agent, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-lg border border-white/5 bg-surface/50"
                  >
                    <span className="font-mono text-primary font-bold">{agent.name}</span>
                    <span className="text-white/60 text-sm">— {agent.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 relative aspect-square max-w-md mx-auto">
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

        {/* CTA strip */}
        <section className="container mx-auto px-4 md:px-6 py-20">
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 p-10 text-center">
            <h3 className="text-2xl md:text-4xl font-bold text-white mb-4">
              Ready to see the agents in action?
            </h3>
            <p className="text-muted mb-6">
              Create a free account, pick a demo prompt, and watch the pipeline run live.
            </p>
            <Link href="/login">
              <Button size="lg" className="h-12 px-8 text-base font-bold">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
