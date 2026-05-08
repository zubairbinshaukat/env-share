/**
 * Browser-local storage helpers for EnvShare (Phase 2, no backend).
 * Centralizes storage keys, UUID bootstrap, and share code generation.
 */

import type { Project } from "@/lib/types"

export const STORAGE_KEYS = {
  userId: "envshare_user_id",
  projects: "envshare_projects",
} as const

const SHARE_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false
  try {
    const probe = "__envshare_probe__"
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function fallbackUuid(): string {
  // RFC4122-ish v4 fallback when crypto.randomUUID is unavailable.
  const rnd = (n: number) =>
    Math.floor(Math.random() * 16 ** n)
      .toString(16)
      .padStart(n, "0")
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${((Math.random() * 4) | 8).toString(
    16,
  )}${rnd(3)}-${rnd(12)}`
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID()
    } catch {
      // fall through
    }
  }
  return fallbackUuid()
}

export function generateShareCode(length = 10): string {
  const out: string[] = []
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(length)
    crypto.getRandomValues(buf)
    for (let i = 0; i < length; i++) {
      out.push(SHARE_CODE_ALPHABET[buf[i] % SHARE_CODE_ALPHABET.length])
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(
        SHARE_CODE_ALPHABET[
          Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)
        ],
      )
    }
  }
  return out.join("")
}

export function ensureUserId(): string {
  if (!isStorageAvailable()) return generateUuid()
  const existing = window.localStorage.getItem(STORAGE_KEYS.userId)
  if (existing && existing.length > 0) return existing
  const fresh = generateUuid()
  window.localStorage.setItem(STORAGE_KEYS.userId, fresh)
  return fresh
}

export function getUserId(): string | null {
  if (!isStorageAvailable()) return null
  return window.localStorage.getItem(STORAGE_KEYS.userId)
}

function isProjectShape(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.shareCode === "string" &&
    Array.isArray(v.environments) &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number" &&
    typeof v.source === "object"
  )
}

export function loadProjects(): Project[] {
  if (!isStorageAvailable()) return []
  const raw = window.localStorage.getItem(STORAGE_KEYS.projects)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isProjectShape)
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]): void {
  if (!isStorageAvailable()) return
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.projects,
      JSON.stringify(projects),
    )
  } catch {
    // Quota or serialization error — silently no-op; caller may surface a toast.
  }
}
