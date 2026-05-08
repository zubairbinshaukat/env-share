/** Shared project record shape stored in Redis. */

export type ProjectSource = "manual" | "folder"

export interface ProjectRecord {
  shareCode: string
  name: string
  ciphertext: string
  iv: string
  ownerId: string
  createdAt: number
  updatedAt: number
  environmentCount: number
  environmentFilenames: string[]
  /** "manual" for paste-in projects, "folder" for FS Access imports. */
  source: ProjectSource
  /** Stable hash of (folderName + sorted env filenames). Only set for folder imports. */
  folderFingerprint?: string
  /** Display name of the originally selected folder. Only set for folder imports. */
  folderName?: string
}

export type ProjectMetaResponse = Pick<
  ProjectRecord,
  | "shareCode"
  | "name"
  | "createdAt"
  | "updatedAt"
  | "environmentCount"
  | "environmentFilenames"
  | "source"
  | "folderFingerprint"
  | "folderName"
>

export function toMetaResponse(record: ProjectRecord): ProjectMetaResponse {
  return {
    shareCode: record.shareCode,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    environmentCount: record.environmentCount ?? 0,
    environmentFilenames: record.environmentFilenames ?? [],
    source: record.source ?? "manual",
    folderFingerprint: record.folderFingerprint,
    folderName: record.folderName,
  }
}
