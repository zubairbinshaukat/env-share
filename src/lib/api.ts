import { useAuth } from "@clerk/clerk-react"
import { useCallback, useMemo } from "react"

import type {
  EncryptedEnvelope,
  ProjectCipherRecord,
  ProjectMeta,
} from "@/lib/types"

interface CreateProjectPayload extends EncryptedEnvelope {
  name: string
}

interface UpdateProjectPayload extends EncryptedEnvelope {
  name: string
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = (await res.json()) as {
        error?: { message?: string }
      }
      message = body.error?.message ?? message
    } catch {
      // keep fallback message
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
      const response = await fetch(path, { ...init, headers })
      return parseJson<T>(response)
    },
    [getToken],
  )

  const publicRequest = useCallback(async <T>(path: string): Promise<T> => {
    const response = await fetch(path)
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
        getSharedProject,
      }) as const,
    [
      listProjects,
      createProject,
      getProject,
      updateProject,
      deleteProject,
      getSharedProject,
    ],
  )
}
