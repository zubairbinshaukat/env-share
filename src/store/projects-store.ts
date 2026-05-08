import { create } from "zustand"

import {
  decryptJSON,
  encryptJSON,
  exportKeyB64,
  generateKey,
  importKeyB64,
} from "@/lib/crypto"
import type {
  ProjectEnvironment,
  ProjectMeta,
  ProjectSource,
} from "@/lib/types"
import type { useApi, UpdateProjectPayload } from "@/lib/api"
import type { ProjectCipherRecord } from "@/lib/types"

const PROJECT_KEY_PREFIX = "project_key_"

type ApiClient = ReturnType<typeof useApi>

export interface CreateProjectInput {
  name: string
  environments: ProjectEnvironment[]
  source?: ProjectSource
  folderFingerprint?: string
  folderName?: string
}

export interface DecryptedProject {
  shareCode: string
  name: string
  environments: ProjectEnvironment[]
  createdAt: number
  updatedAt: number
  source: ProjectSource
  folderFingerprint?: string
  folderName?: string
}

export class MissingKeyError extends Error {
  constructor(shareCode: string) {
    super(`Missing key for project ${shareCode}`)
    this.name = "MissingKeyError"
  }
}

function getKeyStorageName(shareCode: string): string {
  return `${PROJECT_KEY_PREFIX}${shareCode}`
}

export function saveProjectKey(shareCode: string, key: string): void {
  window.localStorage.setItem(getKeyStorageName(shareCode), key)
}

export function readProjectKey(shareCode: string): string | null {
  return window.localStorage.getItem(getKeyStorageName(shareCode))
}

export function removeProjectKey(shareCode: string): void {
  window.localStorage.removeItem(getKeyStorageName(shareCode))
}

async function decryptRecord(record: ProjectCipherRecord): Promise<DecryptedProject> {
  const keyB64 = readProjectKey(record.shareCode)
  if (!keyB64) throw new MissingKeyError(record.shareCode)

  const key = await importKeyB64(keyB64)
  const environments = await decryptJSON<ProjectEnvironment[]>(key, {
    ciphertext: record.ciphertext,
    iv: record.iv,
  })

  return {
    shareCode: record.shareCode,
    name: record.name,
    environments,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source ?? "manual",
    folderFingerprint: record.folderFingerprint,
    folderName: record.folderName,
  }
}

interface ProjectsState {
  projects: ProjectMeta[]
  loadingList: boolean
  error: string | null
  setProjects: (projects: ProjectMeta[]) => void
  fetchProjects: (api: ApiClient) => Promise<void>
  createProject: (api: ApiClient, input: CreateProjectInput) => Promise<ProjectMeta>
  /** Re-encrypt and PUT a manual edit (or full folder sync) of environments. */
  syncProject: (
    api: ApiClient,
    shareCode: string,
    input: { environments: ProjectEnvironment[] },
  ) => Promise<ProjectMeta>
  /** Partial update — name/source/folderName/folderFingerprint only. */
  patchProject: (
    api: ApiClient,
    shareCode: string,
    patch: UpdateProjectPayload,
  ) => Promise<ProjectMeta>
  deleteProject: (api: ApiClient, shareCode: string) => Promise<void>
  duplicateProject: (
    api: ApiClient,
    shareCode: string,
  ) => Promise<ProjectMeta>
  regenerateShareCode: (
    api: ApiClient,
    shareCode: string,
  ) => Promise<ProjectMeta>
  getDecryptedProject: (api: ApiClient, shareCode: string) => Promise<DecryptedProject>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loadingList: false,
  error: null,

  setProjects: (projects) => set({ projects }),

  fetchProjects: async (api) => {
    set({ loadingList: true, error: null })
    try {
      const projects = await api.listProjects()
      set({ projects })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not load projects" })
    } finally {
      set({ loadingList: false })
    }
  },

  createProject: async (api, input) => {
    const key = await generateKey()
    const keyB64 = await exportKeyB64(key)
    const payload = await encryptJSON(key, input.environments)
    const created = await api.createProject({
      name: input.name,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      environmentCount: input.environments.length,
      environmentFilenames: input.environments.map((env) => env.filename),
      source: input.source,
      folderFingerprint: input.folderFingerprint,
      folderName: input.folderName,
    })
    saveProjectKey(created.shareCode, keyB64)
    set((state) => ({ projects: [created, ...state.projects] }))
    return created
  },

  syncProject: async (api, shareCode, input) => {
    const keyB64 = readProjectKey(shareCode)
    if (!keyB64) throw new MissingKeyError(shareCode)
    const key = await importKeyB64(keyB64)
    const payload = await encryptJSON(key, input.environments)
    const updated = await api.updateProject(shareCode, {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      environmentCount: input.environments.length,
      environmentFilenames: input.environments.map((env) => env.filename),
    })
    set((state) => ({
      projects: state.projects.map((project) =>
        project.shareCode === shareCode ? updated : project,
      ),
    }))
    return updated
  },

  patchProject: async (api, shareCode, patch) => {
    const updated = await api.updateProject(shareCode, patch)
    set((state) => ({
      projects: state.projects.map((project) =>
        project.shareCode === shareCode ? updated : project,
      ),
    }))
    return updated
  },

  deleteProject: async (api, shareCode) => {
    await api.deleteProject(shareCode)
    removeProjectKey(shareCode)
    set((state) => ({
      projects: state.projects.filter((project) => project.shareCode !== shareCode),
    }))
  },

  duplicateProject: async (api, shareCode) => {
    const original = await get().getDecryptedProject(api, shareCode)
    const copyName = `${original.name} (copy)`
    return get().createProject(api, {
      name: copyName,
      environments: original.environments.map((env) => ({ ...env })),
      source: "manual",
    })
  },

  regenerateShareCode: async (api, shareCode) => {
    const decrypted = await get().getDecryptedProject(api, shareCode)
    const newKey = await generateKey()
    const newKeyB64 = await exportKeyB64(newKey)
    const payload = await encryptJSON(newKey, decrypted.environments)
    const updated = await api.regenerateProject(shareCode, {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
    })
    saveProjectKey(updated.shareCode, newKeyB64)
    removeProjectKey(shareCode)
    set((state) => ({
      projects: state.projects.map((project) =>
        project.shareCode === shareCode ? updated : project,
      ),
    }))
    return updated
  },

  getDecryptedProject: async (api, shareCode) => {
    const project = await api.getProject(shareCode)
    return decryptRecord(project)
  },
}))
