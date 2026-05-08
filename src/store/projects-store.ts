import { create } from "zustand"

import {
  decryptJSON,
  encryptJSON,
  exportKeyB64,
  generateKey,
  importKeyB64,
} from "@/lib/crypto"
import type { ProjectEnvironment, ProjectMeta } from "@/lib/types"
import type { useApi } from "@/lib/api"
import type {
  ProjectCipherRecord,
} from "@/lib/types"

const PROJECT_KEY_PREFIX = "project_key_"

type ApiClient = ReturnType<typeof useApi>

export interface CreateProjectInput {
  name: string
  environments: ProjectEnvironment[]
}

export interface DecryptedProject {
  shareCode: string
  name: string
  environments: ProjectEnvironment[]
  createdAt: number
  updatedAt: number
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

function saveProjectKey(shareCode: string, key: string): void {
  window.localStorage.setItem(getKeyStorageName(shareCode), key)
}

function readProjectKey(shareCode: string): string | null {
  return window.localStorage.getItem(getKeyStorageName(shareCode))
}

function removeProjectKey(shareCode: string): void {
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
  }
}

interface ProjectsState {
  projects: ProjectMeta[]
  loadingList: boolean
  error: string | null
  setProjects: (projects: ProjectMeta[]) => void
  fetchProjects: (api: ApiClient) => Promise<void>
  createProject: (api: ApiClient, input: CreateProjectInput) => Promise<ProjectMeta>
  updateProject: (
    api: ApiClient,
    shareCode: string,
    input: CreateProjectInput,
  ) => Promise<ProjectMeta>
  deleteProject: (api: ApiClient, shareCode: string) => Promise<void>
  getDecryptedProject: (api: ApiClient, shareCode: string) => Promise<DecryptedProject>
}

export const useProjectsStore = create<ProjectsState>((set) => ({
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
    })
    saveProjectKey(created.shareCode, keyB64)
    set((state) => ({ projects: [created, ...state.projects] }))
    return created
  },

  updateProject: async (api, shareCode, input) => {
    const keyB64 = readProjectKey(shareCode)
    if (!keyB64) throw new MissingKeyError(shareCode)
    const key = await importKeyB64(keyB64)
    const payload = await encryptJSON(key, input.environments)
    const updated = await api.updateProject(shareCode, {
      name: input.name,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
    })
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

  getDecryptedProject: async (api, shareCode) => {
    const project = await api.getProject(shareCode)
    return decryptRecord(project)
  },
}))
