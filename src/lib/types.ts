/** Domain types for EnvShare (local-first, Phase 2). */

export type ProjectId = string

export type ShareCode = string

export interface EnvVariable {
  key: string
  value: string
}

export interface ProjectEnvironment {
  /** Stable id for React keys + reordering. */
  id: string
  /** Filename as it appeared on disk (or as the user typed it). e.g. ".env", ".env.local". */
  filename: string
  variables: EnvVariable[]
}

/** Project origin — `manual` for paste-in projects, `folder` for FS imports. */
export type ProjectSource = "manual" | "folder"

/** Legacy local-only project source, kept for migration support. */
export type LegacyProjectSource =
  | { kind: "manual" }
  | { kind: "folder"; folderName: string }

export interface Project {
  id: ProjectId
  name: string
  shareCode: ShareCode
  environments: ProjectEnvironment[]
  source: LegacyProjectSource
  createdAt: number
  updatedAt: number
}

export interface EncryptedEnvelope {
  ciphertext: string
  iv: string
}

export interface ProjectMeta {
  shareCode: string
  name: string
  createdAt: number
  updatedAt: number
  /** Number of environment files in this project. */
  environmentCount: number
  /** Plain filenames for dashboard search/filtering. */
  environmentFilenames?: string[]
  /** Project origin. Defaults to "manual" for projects created before Phase 4.5. */
  source?: ProjectSource
  /** Stable hash of (folderName + sorted env filenames). Only set for folder imports. */
  folderFingerprint?: string
  /** Display name of the originally selected folder. Only set for folder imports. */
  folderName?: string
}

export interface ProjectCipherRecord extends ProjectMeta, EncryptedEnvelope {}
