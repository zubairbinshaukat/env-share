import { encryptJSON, exportKeyB64, generateKey } from "@/lib/crypto"
import { loadProjects, saveProjects, STORAGE_KEYS } from "@/lib/local"
import type { useApi } from "@/lib/api"

export const MIGRATION_DONE_KEY = "envshare_migration_v3_done"

type ApiClient = ReturnType<typeof useApi>

export function isMigrationDone(): boolean {
  return window.localStorage.getItem(MIGRATION_DONE_KEY) === "1"
}

export function markMigrationDone(): void {
  window.localStorage.setItem(MIGRATION_DONE_KEY, "1")
}

export function getLegacyProjectCount(): number {
  return loadProjects().length
}

export async function runMigration(
  api: ApiClient,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const legacyProjects = loadProjects()
  const total = legacyProjects.length

  for (let index = 0; index < total; index++) {
    const project = legacyProjects[index]
    const key = await generateKey()
    const keyB64 = await exportKeyB64(key)
    const encrypted = await encryptJSON(key, project.environments)
    const created = await api.createProject({
      name: project.name,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
    })
    window.localStorage.setItem(`project_key_${created.shareCode}`, keyB64)
    onProgress?.(index + 1, total)
  }

  saveProjects([])
  window.localStorage.removeItem(STORAGE_KEYS.userId)
  markMigrationDone()
}
