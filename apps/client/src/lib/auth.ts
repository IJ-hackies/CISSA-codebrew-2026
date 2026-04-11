/**
 * Simple auth state. Stores JWT in localStorage, exposes reactive user.
 */

import { ref, computed } from 'vue'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const LS_TOKEN_KEY = 'stellaTaco.token'
const LS_USER_KEY = 'stellaTaco.user'

export interface AuthUser {
  id: string
  username: string
}

// Hydrate from localStorage
const storedToken = localStorage.getItem(LS_TOKEN_KEY)
const storedUser = (() => {
  try {
    const raw = localStorage.getItem(LS_USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
})()

const token = ref<string | null>(storedToken)
const user = ref<AuthUser | null>(storedUser)

export const isLoggedIn = computed(() => !!token.value)
export const currentUser = computed(() => user.value)

export function getToken(): string | null {
  return token.value
}

function persist(t: string, u: AuthUser) {
  token.value = t
  user.value = u
  localStorage.setItem(LS_TOKEN_KEY, t)
  localStorage.setItem(LS_USER_KEY, JSON.stringify(u))
}

export function logout() {
  token.value = null
  user.value = null
  localStorage.removeItem(LS_TOKEN_KEY)
  localStorage.removeItem(LS_USER_KEY)
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { token: string; user: AuthUser }
  persist(data.token, data.user)
  return data.user
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { token: string; user: AuthUser }
  persist(data.token, data.user)
  return data.user
}
