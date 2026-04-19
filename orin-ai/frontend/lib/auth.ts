/**
 * Demo auth — localStorage-backed user registry and session.
 *
 * ⚠ This is NOT secure. Client-only storage, no server verification.
 * Ship a real backend auth (JWT + FastAPI users table) before production.
 */

export interface User {
  email: string
  // SHA-256 hex hash of the password. Not a true KDF — demo only.
  passwordHash: string
  createdAt: string
}

export interface Session {
  email: string
  issuedAt: string
}

const USERS_KEY = "orin:users"
const SESSION_KEY = "orin:session"

/**
 * Built-in demo credentials. These are seeded on first load of the app so the
 * demo account is always present, even after a fresh install or localStorage
 * reset. Safe to share publicly — this account only exists in the user's
 * browser; there is no real backend auth behind it.
 */
export const DEMO_EMAIL = "demo@orin.ai"
export const DEMO_PASSWORD = "Orin@Demo2026"

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined"
}

async function sha256(text: string): Promise<string> {
  if (!isBrowser() || !window.crypto?.subtle) {
    throw new Error("Web Crypto not available")
  }
  const buf = new TextEncoder().encode(text)
  const digest = await window.crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function readUsers(): User[] {
  if (!isBrowser()) return []
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as User[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: User[]): void {
  if (!isBrowser()) return
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function validateEmail(email: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return "Please enter a valid email address"
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters"
  if (!/[a-z]/i.test(password)) return "Password must contain a letter"
  if (!/[0-9]/.test(password)) return "Password must contain a number"
  return null
}

export async function signUp(
  email: string,
  password: string,
  confirm: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailErr = validateEmail(email)
  if (emailErr) return { ok: false, error: emailErr }
  const pwErr = validatePassword(password)
  if (pwErr) return { ok: false, error: pwErr }
  if (password !== confirm) return { ok: false, error: "Passwords do not match" }

  const users = readUsers()
  const normalized = email.trim().toLowerCase()
  if (users.some((u) => u.email === normalized)) {
    return { ok: false, error: "An account with this email already exists" }
  }

  const hash = await sha256(password)
  const user: User = {
    email: normalized,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  setSession(normalized)
  return { ok: true }
}

export async function logIn(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailErr = validateEmail(email)
  if (emailErr) return { ok: false, error: emailErr }
  if (!password) return { ok: false, error: "Password is required" }

  const users = readUsers()
  const normalized = email.trim().toLowerCase()
  const user = users.find((u) => u.email === normalized)
  if (!user) return { ok: false, error: "No account found for this email" }

  const hash = await sha256(password)
  if (hash !== user.passwordHash) return { ok: false, error: "Incorrect password" }

  setSession(normalized)
  return { ok: true }
}

export function setSession(email: string): void {
  if (!isBrowser()) return
  const session: Session = { email, issuedAt: new Date().toISOString() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event("orin:auth-change"))
}

export function getSession(): Session | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed || typeof parsed.email !== "string") return null
    return parsed
  } catch {
    return null
  }
}

export function logOut(): void {
  if (!isBrowser()) return
  localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event("orin:auth-change"))
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

/**
 * Idempotent. Makes sure the demo account is registered in localStorage so
 * judges can always log in with the advertised credentials. Safe to call on
 * every page load — it only writes if the user isn't already present.
 */
export async function ensureDemoAccount(): Promise<void> {
  if (!isBrowser()) return
  const users = readUsers()
  if (users.some((u) => u.email === DEMO_EMAIL)) return
  try {
    const hash = await sha256(DEMO_PASSWORD)
    users.push({
      email: DEMO_EMAIL,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    })
    writeUsers(users)
  } catch {
    // If Web Crypto is unavailable, skip silently — demo auth is non-critical.
  }
}
