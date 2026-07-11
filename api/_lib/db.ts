import { createClient } from "@libsql/client/web"
import type { Client, Row } from "@libsql/client"

import type { ProjectRecord, ProjectSource } from "./project-record"

let client: Client | null = null

export function getDb(): Client {
  if (client) return client

  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) {
    throw new Error(
      "Missing Turso configuration. Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN).",
    )
  }

  client = createClient({ url, authToken })
  return client
}

/** Column list, in the canonical order used by INSERT and recordToInsert(). */
export const PROJECT_COLUMNS = [
  "share_code",
  "name",
  "ciphertext",
  "iv",
  "owner_id",
  "created_at",
  "updated_at",
  "environment_count",
  "environment_filenames",
  "source",
  "folder_fingerprint",
  "folder_name",
] as const

/** Parse a JSON array of strings, defaulting to [] on anything malformed. */
function parseFilenames(value: unknown): string[] {
  if (typeof value !== "string") return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed
    }
  } catch {
    // fall through
  }
  return []
}

/** Map a libSQL row into the in-memory ProjectRecord shape used by handlers. */
export function rowToRecord(row: Row): ProjectRecord {
  const source = String(row.source ?? "manual")
  const record: ProjectRecord = {
    shareCode: String(row.share_code),
    name: String(row.name),
    ciphertext: String(row.ciphertext),
    iv: String(row.iv),
    ownerId: String(row.owner_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    environmentCount: Number(row.environment_count ?? 0),
    environmentFilenames: parseFilenames(row.environment_filenames),
    source: (source === "folder" ? "folder" : "manual") as ProjectSource,
  }
  // Preserve "field absent" semantics: only attach folder_* when non-null,
  // so toMetaResponse() and update merges behave exactly as with Redis.
  if (row.folder_fingerprint != null) {
    record.folderFingerprint = String(row.folder_fingerprint)
  }
  if (row.folder_name != null) {
    record.folderName = String(row.folder_name)
  }
  return record
}

/** Positional args for an INSERT, aligned with PROJECT_COLUMNS. */
export function recordToInsert(record: ProjectRecord): Array<string | number | null> {
  return [
    record.shareCode,
    record.name,
    record.ciphertext,
    record.iv,
    record.ownerId,
    record.createdAt,
    record.updatedAt,
    record.environmentCount,
    JSON.stringify(record.environmentFilenames ?? []),
    record.source,
    record.folderFingerprint ?? null,
    record.folderName ?? null,
  ]
}
