/**
 * Compare two sets of environment files and produce a structured diff.
 * Used by the folder re-import flow to show users what would change before syncing.
 */

import type { EnvVariable, ProjectEnvironment } from "@/lib/types"

export interface KeyChange {
  key: string
  oldValue: string
  newValue: string
}

/** Per-file diff (already-existing files). */
export interface FileDiff {
  filename: string
  oldId?: string
  newId?: string
  added: EnvVariable[]
  removed: EnvVariable[]
  changed: KeyChange[]
}

export interface ProjectDiff {
  /** Files present in the new scan that weren't in the old project. */
  addedFiles: ProjectEnvironment[]
  /** Files present in the old project but missing from the new scan. */
  removedFiles: ProjectEnvironment[]
  /** Files present in both, with their per-key diff. */
  modifiedFiles: FileDiff[]
  /** Files present in both with no key-level differences. */
  unchangedFiles: FileDiff[]
}

function indexByFilename<T extends { filename: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items) {
    map.set(item.filename, item)
  }
  return map
}

function indexByKey(variables: EnvVariable[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const variable of variables) {
    map.set(variable.key, variable.value)
  }
  return map
}

function diffVariables(
  oldVars: EnvVariable[],
  newVars: EnvVariable[],
): { added: EnvVariable[]; removed: EnvVariable[]; changed: KeyChange[] } {
  const oldMap = indexByKey(oldVars)
  const newMap = indexByKey(newVars)
  const added: EnvVariable[] = []
  const removed: EnvVariable[] = []
  const changed: KeyChange[] = []

  for (const [key, value] of newMap) {
    if (!oldMap.has(key)) {
      added.push({ key, value })
    } else if (oldMap.get(key) !== value) {
      changed.push({ key, oldValue: oldMap.get(key) ?? "", newValue: value })
    }
  }
  for (const [key, value] of oldMap) {
    if (!newMap.has(key)) removed.push({ key, value })
  }

  return { added, removed, changed }
}

/** Compare an existing project's environments to a fresh scan. */
export function diffEnvironments(
  oldEnvs: ProjectEnvironment[],
  newEnvs: ProjectEnvironment[],
): ProjectDiff {
  const oldByName = indexByFilename(oldEnvs)
  const newByName = indexByFilename(newEnvs)

  const addedFiles: ProjectEnvironment[] = []
  const removedFiles: ProjectEnvironment[] = []
  const modifiedFiles: FileDiff[] = []
  const unchangedFiles: FileDiff[] = []

  for (const [filename, newEnv] of newByName) {
    const oldEnv = oldByName.get(filename)
    if (!oldEnv) {
      addedFiles.push(newEnv)
      continue
    }
    const { added, removed, changed } = diffVariables(
      oldEnv.variables,
      newEnv.variables,
    )
    const fileDiff: FileDiff = {
      filename,
      oldId: oldEnv.id,
      newId: newEnv.id,
      added,
      removed,
      changed,
    }
    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
      unchangedFiles.push(fileDiff)
    } else {
      modifiedFiles.push(fileDiff)
    }
  }

  for (const [filename, oldEnv] of oldByName) {
    if (!newByName.has(filename)) removedFiles.push(oldEnv)
  }

  return { addedFiles, removedFiles, modifiedFiles, unchangedFiles }
}

/** True if the two environment sets are byte-for-byte identical (ignoring order). */
export function isProjectDiffEmpty(diff: ProjectDiff): boolean {
  return (
    diff.addedFiles.length === 0 &&
    diff.removedFiles.length === 0 &&
    diff.modifiedFiles.length === 0
  )
}

/** Total number of changes across all categories. */
export function countDiffChanges(diff: ProjectDiff): number {
  let total = diff.addedFiles.length + diff.removedFiles.length
  for (const file of diff.modifiedFiles) {
    total += file.added.length + file.removed.length + file.changed.length
  }
  return total
}
