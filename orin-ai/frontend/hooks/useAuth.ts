"use client"
import { useEffect, useState, useCallback } from "react"
import { getSession, logOut as doLogOut, type Session } from "@/lib/auth"

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(getSession())
    setReady(true)

    const refresh = () => setSession(getSession())
    window.addEventListener("orin:auth-change", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("orin:auth-change", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const logout = useCallback(() => {
    doLogOut()
  }, [])

  return {
    session,
    isAuthenticated: session !== null,
    ready,
    logout,
  }
}
