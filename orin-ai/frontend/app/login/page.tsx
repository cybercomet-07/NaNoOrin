"use client"

import { motion } from "framer-motion"
import { useEffect, useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Logo } from "@/components/shared/Logo"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { logIn, signUp } from "@/lib/auth"
import { useAuth } from "@/hooks/useAuth"

function AuthPageInner() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const router = useRouter()
  const params = useSearchParams()
  const { isAuthenticated, ready } = useAuth()

  const next = params.get("next") || "/workspace/demo"

  useEffect(() => {
    if (ready && isAuthenticated) {
      router.replace(next)
    }
  }, [ready, isAuthenticated, next, router])

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

          <p className="mt-6 font-mono text-xs text-[var(--terminal-gray)]">
            Demo auth — accounts are stored in this browser&apos;s localStorage. Not production-safe.
          </p>
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
