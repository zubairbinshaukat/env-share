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

export type ProjectSource =
  | { kind: "manual" }
  | {
      kind: "folder"
      /** Display name of the originally selected folder (best-effort). */
      folderName: string
    }

export interface Project {
  id: ProjectId
  name: string
  shareCode: ShareCode
  environments: ProjectEnvironment[]
  source: ProjectSource
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
}

export interface ProjectCipherRecord extends ProjectMeta, EncryptedEnvelope {}
