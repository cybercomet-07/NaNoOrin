"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/Logo";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/workspace");
  };

  return (
    <div className="min-h-screen flex selection:bg-primary/30 selection:text-white">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-surface/50 relative border-r border-white/5 flex-col justify-between p-12 overflow-hidden">
        {/* Background glow graphics */}
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
              ⚡ Build in Minutes
            </span>
            <span className="inline-flex items-center rounded-full bg-secondary/10 border border-secondary/20 px-3 py-1 text-sm font-medium text-secondary">
              🤖 AI Powered
            </span>
            <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-sm font-medium text-white">
              🚀 Launch Faster
            </span>
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
            <h2 className="text-3xl font-bold text-white mb-2">{isLogin ? "Welcome back" : "Create an account"}</h2>
            <p className="text-muted">
              {isLogin ? "Enter your credentials to access your workspace." : "Join the AI-powered startup revolution."}
            </p>
          </div>

          {/* Custom Tabs */}
          <div className="flex bg-surface p-1 rounded-lg mb-8 border border-white/5">
            <button 
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${isLogin ? "bg-card text-white shadow" : "text-muted hover:text-white"}`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button 
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${!isLogin ? "bg-card text-white shadow" : "text-muted hover:text-white"}`}
              onClick={() => setIsLogin(false)}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Email</label>
              <Input type="email" placeholder="name@example.com" required />
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
              <Input type="password" placeholder="••••••••" required />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Confirm Password</label>
                <Input type="password" placeholder="••••••••" required />
              </div>
            )}

            <Button type="submit" className="w-full mt-4 h-11 text-base">
              {isLogin ? "Log In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-8 flex items-center">
            <div className="flex-grow border-t border-white/10" />
            <span className="px-3 text-xs text-muted uppercase bg-background">Or continue with</span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <Button variant="outline" className="h-11 border-white/10 bg-surface/50 hover:bg-surface">
              <svg className="h-5 w-5 mr-2" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
                <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
                <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
                <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26537 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
              </svg>
              Google
            </Button>
            <Button variant="outline" className="h-11 border-white/10 bg-surface/50 hover:bg-surface">
              <svg className="h-5 w-5 mr-2" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57A12.02 12.02 0 0024 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
