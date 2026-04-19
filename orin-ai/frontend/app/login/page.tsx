"use client"

import { motion } from "framer-motion"
import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Copy, Loader2, Sparkles } from "lucide-react"
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  ensureDemoAccount,
  logIn,
  signUp,
} from "@/lib/auth"
import { useAuth } from "@/hooks/useAuth"

function AuthPageInner() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState<"email" | "password" | null>(null)

  const router = useRouter()
  const params = useSearchParams()
  const { isAuthenticated, ready } = useAuth()

  const next = params.get("next") || "/workspace/demo"

  useEffect(() => {
    ensureDemoAccount()
  }, [])

  useEffect(() => {
    if (ready && isAuthenticated) {
      router.replace(next)
    }
  }, [ready, isAuthenticated, next, router])

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setConfirm(DEMO_PASSWORD)
    setIsLogin(true)
    setError("")
  }

  const copyToClipboard = async (
    text: string,
    which: "email" | "password",
  ) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      window.setTimeout(
        () => setCopied((c) => (c === which ? null : c)),
        1200,
      )
    } catch {
      // ignore
    }
  }

  const loginAsDemo = async () => {
    setError("")
    setSubmitting(true)
    try {
      await ensureDemoAccount()
      const result = await logIn(DEMO_EMAIL, DEMO_PASSWORD)
      if (result.ok) {
        router.replace(next)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const result = isLogin
        ? await logIn(email, password)
        : await signUp(email, password, confirm)
      if (result.ok) {
        router.replace(next)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (login: boolean) => {
    setIsLogin(login)
    setError("")
  }

  return (
    <div className="min-h-screen flex selection:bg-primary/30 selection:text-white">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-surface/50 relative border-r border-white/5 flex-col justify-between p-12 overflow-hidden">
        <div className="absolute top-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[20%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[150px] pointer-events-none" />

        <div className="relative z-10">
          <Logo />
        </div>

        <motion.div
          className="relative z-10 flex flex-col gap-6 max-w-xl"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Welcome to OrinAI
          </h1>
          <p className="text-lg text-muted">
            Build products, generate websites, and launch startups using autonomous AI agents.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-sm font-medium text-primary">
              Build in Minutes
            </span>
            <span className="inline-flex items-center rounded-full bg-secondary/10 border border-secondary/20 px-3 py-1 text-sm font-medium text-secondary">
              AI Powered
            </span>
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm font-medium text-white">
              Launch Faster
            </span>
          </div>

          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 max-w-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
              Demo credentials
            </p>
            <p className="font-mono text-sm text-white/90 leading-relaxed">
              {DEMO_EMAIL}
              <br />
              {DEMO_PASSWORD}
            </p>
            <p className="mt-2 text-xs text-[var(--terminal-gray)]">
              Use these on the right to log in instantly.
            </p>
          </div>
        </motion.div>

        <div className="relative z-10 text-sm text-muted">
          © {new Date().getFullYear()} OrinAI. The Multi-Agent Startup Engine.
        </div>
      </div>

      {/* RIGHT SIDE - AUTH */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-8 relative">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] via-background to-background pointer-events-none" />

        <motion.div
          className="w-full max-w-md relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="lg:hidden mb-12">
            <Logo />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="text-muted">
              {isLogin
                ? "Enter your credentials to access your workspace."
                : "Join the AI-powered startup revolution."}
            </p>
          </div>

          {/* DEMO CREDENTIALS CARD — one-click login for judges */}
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-white">
                Demo account (for judges)
              </h3>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-2 rounded-md bg-black/30 border border-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    Email
                  </div>
                  <div className="font-mono text-sm text-white truncate">
                    {DEMO_EMAIL}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(DEMO_EMAIL, "email")}
                  className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-white/60 hover:text-primary hover:bg-white/5 transition-colors"
                  title="Copy email"
                >
                  {copied === "email" ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md bg-black/30 border border-white/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">
                    Password
                  </div>
                  <div className="font-mono text-sm text-white truncate">
                    {DEMO_PASSWORD}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(DEMO_PASSWORD, "password")}
                  className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-white/60 hover:text-primary hover:bg-white/5 transition-colors"
                  title="Copy password"
                >
                  {copied === "password" ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={loginAsDemo}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Logging in…
                  </>
                ) : (
                  "Log in with demo account"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={fillDemoCredentials}
              >
                Autofill
              </Button>
            </div>
          </div>

          <div className="flex bg-surface p-1 gap-1 rounded-lg mb-8 border border-white/5">
            <Button
              type="button"
              variant="ghost"
              className={`flex-1 h-auto py-2 px-4 transition-all ${
                isLogin
                  ? "bg-card text-white shadow shadow-black/50 hover:bg-card hover:bg-card/90"
                  : "text-muted"
              }`}
              onClick={() => switchMode(true)}
            >
              Login
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={`flex-1 h-auto py-2 px-4 transition-all ${
                !isLogin
                  ? "bg-card text-white shadow shadow-black/50 hover:bg-card hover:bg-card/90"
                  : "text-muted"
              }`}
              onClick={() => switchMode(false)}
            >
              Sign Up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Email</label>
              <Input
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/80">Password</label>
                {isLogin && (
                  <Link href="#" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-400 font-mono border border-red-500/20 bg-red-500/5 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full mt-4 h-11 text-base" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Logging in…" : "Creating account…"}
                </>
              ) : isLogin ? (
                "Log In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted">
            {isLogin ? "New to OrinAI?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => switchMode(!isLogin)}
            >
              {isLogin ? "Create one" : "Log in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-white">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      }
    >
      <AuthPageInner />
    </Suspense>
  )
}
