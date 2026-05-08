/**
 * Zustand store for projects.
 * - Mirrors `projects` to localStorage under `envshare_projects`.
 * - Exposes actions for create/import/update/rescan/remove.
 */

import { create } from "zustand"

import {
  generateShareCode,
  generateUuid,
  loadProjects,
  saveProjects,
} from "@/lib/local"
import type {
  EnvVariable,
  Project,
  ProjectEnvironment,
  ProjectId,
  ProjectSource,
} from "@/lib/types"

export interface ManualProjectInput {
  name: string
  environments: Array<{
    filename: string
    variables: EnvVariable[]
  }>
}

export interface FolderProjectInput {
  name: string
  folderName: string
  environments: Array<{
    filename: string
    variables: EnvVariable[]
  }>
}

interface ProjectsState {
  projects: Project[]
  hydrated: boolean
  hydrate: () => void
  getProject: (id: ProjectId) => Project | undefined
  createManualProject: (input: ManualProjectInput) => Project
  createFolderProject: (input: FolderProjectInput) => Project
  createFolderProjects: (inputs: FolderProjectInput[]) => Project[]
  rescanProject: (
    id: ProjectId,
    environments: ProjectEnvironment[],
  ) => Project | undefined
  removeProject: (id: ProjectId) => void
}

function persist(projects: Project[]): void {
  saveProjects(projects)
}

function makeProject(args: {
  name: string
  source: ProjectSource
  environments: Array<{ filename: string; variables: EnvVariable[] }>
}): Project {
  const now = Date.now()
  return {
    id: generateUuid(),
    name: args.name.trim() || "Untitled project",
    shareCode: generateShareCode(),
    source: args.source,
    environments: args.environments.map((env) => ({
      id: generateUuid(),
      filename: env.filename.trim() || ".env",
      variables: env.variables,
    })),
    createdAt: now,
    updatedAt: now,
  }
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    const projects = loadProjects()
    set({ projects, hydrated: true })
  },

  getProject: (id) => get().projects.find((p) => p.id === id),

  createManualProject: (input) => {
    const project = makeProject({
      name: input.name,
      source: { kind: "manual" },
      environments: input.environments,
    })
    const next = [project, ...get().projects]
    set({ projects: next })
    persist(next)
    return project
  },

  createFolderProject: (input) => {
    const project = makeProject({
      name: input.name,
      source: { kind: "folder", folderName: input.folderName },
      environments: input.environments,
    })
    const next = [project, ...get().projects]
    set({ projects: next })
    persist(next)
    return project
  },

  createFolderProjects: (inputs) => {
    const created: Project[] = inputs.map((input) =>
      makeProject({
        name: input.name,
        source: { kind: "folder", folderName: input.folderName },
        environments: input.environments,
      }),
    )
    const next = [...created, ...get().projects]
    set({ projects: next })
    persist(next)
    return created
  },

  rescanProject: (id, environments) => {
    const list = get().projects
    const idx = list.findIndex((p) => p.id === id)
    if (idx === -1) return undefined
    const updated: Project = {
      ...list[idx],
      environments,
      updatedAt: Date.now(),
    }
    const next = [...list]
    next[idx] = updated
    set({ projects: next })
    persist(next)
    return updated
  },

  removeProject: (id) => {
    const next = get().projects.filter((p) => p.id !== id)
    set({ projects: next })
    persist(next)
  },
}))
