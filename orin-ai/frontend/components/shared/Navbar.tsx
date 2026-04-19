"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "./Logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export function Navbar() {
  const { session, logout, ready } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.replace("/")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden md:flex gap-6 items-center">
          <Link href="#product" className="text-sm font-medium text-muted hover:text-white transition-colors">
            Product
          </Link>
          <Link href="#how-it-works" className="text-sm font-medium text-muted hover:text-white transition-colors">
            How It Works
          </Link>
          <Link href="#about" className="text-sm font-medium text-muted hover:text-white transition-colors">
            Agents
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {ready && session ? (
            <>
              <span className="hidden sm:inline text-xs font-mono text-muted truncate max-w-[180px]">
                {session.email}
              </span>
              <Link href="/workspace/demo">
                <Button size="sm">Workspace</Button>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-white hover:text-primary transition-colors hidden sm:block"
              >
                Log in
              </Link>
              <Link href="/login">
                <Button size="sm">Start Free</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
