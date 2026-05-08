import { useAuth } from "@clerk/clerk-react"
import { useCallback, useMemo } from "react"

import type {
  EncryptedEnvelope,
  ProjectCipherRecord,
  ProjectMeta,
  ProjectSource,
} from "@/lib/types"

interface CreateProjectPayload extends EncryptedEnvelope {
  name: string
  environmentCount: number
  environmentFilenames: string[]
  source?: ProjectSource
  folderFingerprint?: string
  folderName?: string
}

/** Partial update — backend accepts any subset; ciphertext+iv must change together with env metadata. */
export interface UpdateProjectPayload extends Partial<EncryptedEnvelope> {
  name?: string
  environmentCount?: number
  environmentFilenames?: string[]
  source?: ProjectSource
  folderFingerprint?: string | null
  folderName?: string | null
}

type RegeneratePayload = EncryptedEnvelope

/** Thrown when POST /api/projects detects an existing project with the same fingerprint. */
export class FingerprintConflictError extends Error {
  shareCode: string
  existingName: string
  existingUpdatedAt: number
  constructor(args: { shareCode: string; existingName: string; existingUpdatedAt: number }) {
    super(`A project with this fingerprint already exists: ${args.existingName}`)
    this.name = "FingerprintConflictError"
    this.shareCode = args.shareCode
    this.existingName = args.existingName
    this.existingUpdatedAt = args.existingUpdatedAt
  }
}

function withApiBase(path: string): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!apiBase) return path
  return new URL(path, apiBase.endsWith("/") ? apiBase : `${apiBase}/`).toString()
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    let body: Record<string, unknown> | null = null
    try {
      body = (await res.json()) as Record<string, unknown>
      const err = (body?.error ?? {}) as Record<string, unknown>
      if (typeof err.message === "string") message = err.message
    } catch {
      // keep fallback message
    }
    if (res.status === 409 && body) {
      const err = (body.error ?? {}) as Record<string, unknown>
      if (
        err.code === "duplicate_fingerprint" &&
        typeof err.shareCode === "string" &&
        typeof err.name === "string"
      ) {
        throw new FingerprintConflictError({
          shareCode: err.shareCode,
          existingName: err.name,
          existingUpdatedAt:
            typeof err.updatedAt === "number" ? err.updatedAt : Date.now(),
        })
      }
    }
    throw new Error(message)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export function useApi() {
  const { getToken } = useAuth()

  const protectedRequest = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken()
      if (!token) {
        throw new Error("Not authenticated")
      }
      const headers = new Headers(init?.headers)
      headers.set("Authorization", `Bearer ${token}`)
      headers.set("Content-Type", "application/json")
      const response = await fetch(withApiBase(path), { ...init, headers })
      return parseJson<T>(response)
    },
    [getToken],
  )

  const publicRequest = useCallback(async <T>(path: string): Promise<T> => {
    const response = await fetch(withApiBase(path))
    return parseJson<T>(response)
  }, [])

  const listProjects = useCallback(async (): Promise<ProjectMeta[]> => {
    const data = await protectedRequest<{ projects: ProjectMeta[] }>(
      "/api/projects",
    )
    return data.projects
  }, [protectedRequest])

  const createProject = useCallback(
    async (payload: CreateProjectPayload): Promise<ProjectMeta> =>
      protectedRequest<ProjectMeta>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    [protectedRequest],
  )

  const getProject = useCallback(
    async (shareCode: string): Promise<ProjectCipherRecord> =>
      protectedRequest<ProjectCipherRecord>(
        `/api/projects/${encodeURIComponent(shareCode)}`,
      ),
    [protectedRequest],
  )

  const updateProject = useCallback(
    async (
      shareCode: string,
      payload: UpdateProjectPayload,
    ): Promise<ProjectMeta> =>
      protectedRequest<ProjectMeta>(
        `/api/projects/${encodeURIComponent(shareCode)}`,
        { method: "PUT", body: JSON.stringify(payload) },
      ),
    [protectedRequest],
  )

  const deleteProject = useCallback(
    async (shareCode: string): Promise<void> => {
      await protectedRequest<void>(`/api/projects/${encodeURIComponent(shareCode)}`, {
        method: "DELETE",
      })
    },
    [protectedRequest],
  )

  const regenerateProject = useCallback(
    async (
      shareCode: string,
      payload: RegeneratePayload,
    ): Promise<ProjectMeta> =>
      protectedRequest<ProjectMeta>(
        `/api/projects/${encodeURIComponent(shareCode)}/regenerate`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    [protectedRequest],
  )

  const getSharedProject = useCallback(
    async (shareCode: string): Promise<ProjectCipherRecord> =>
      publicRequest<ProjectCipherRecord>(`/api/share/${encodeURIComponent(shareCode)}`),
    [publicRequest],
  )

  return useMemo(
    () =>
      ({
        listProjects,
        createProject,
        getProject,
        updateProject,
        deleteProject,
        regenerateProject,
        getSharedProject,
      }) as const,
    [
      listProjects,
      createProject,
      getProject,
      updateProject,
      deleteProject,
      regenerateProject,
      getSharedProject,
    ],
  )
}
