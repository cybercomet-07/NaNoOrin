"use client"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

interface Props {
  children: React.ReactNode
  /** Where to send unauthenticated users. */
  redirectTo?: string
}

export default function AuthGuard({ children, redirectTo = "/login" }: Props) {
  const { ready, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || "/workspace")
      router.replace(`${redirectTo}?next=${next}`)
    }
  }, [ready, isAuthenticated, redirectTo, router, pathname])

  if (!ready || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-white">
        <div className="flex items-center gap-3 text-[var(--terminal-gray)] font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking session…
        </div>
      </div>
    )
  }

  return <>{children}</>
}
