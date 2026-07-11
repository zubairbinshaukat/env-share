import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../_lib/auth"
import {
  getDb,
  PROJECT_COLUMNS,
  recordToInsert,
  rowToRecord,
} from "../_lib/db"
import { error, json } from "../_lib/http"
import {
  toMetaResponse,
  type ProjectRecord,
  type ProjectSource,
} from "../_lib/project-record"
import { createUniqueShareCode } from "../_lib/share-code"

interface CreateBody {
  name: string
  ciphertext: string
  iv: string
  environmentCount: number
  environmentFilenames: string[]
  source?: ProjectSource
  folderFingerprint?: string
  folderName?: string
}

function isCreateBody(body: unknown): body is CreateBody {
  if (!body || typeof body !== "object") return false
  const value = body as Record<string, unknown>
  if (
    typeof value.name !== "string" ||
    typeof value.ciphertext !== "string" ||
    typeof value.iv !== "string" ||
    typeof value.environmentCount !== "number" ||
    !Number.isFinite(value.environmentCount) ||
    value.environmentCount < 0 ||
    !Array.isArray(value.environmentFilenames) ||
    !value.environmentFilenames.every((item) => typeof item === "string")
  ) {
    return false
  }
  if (
    value.source !== undefined &&
    value.source !== "manual" &&
    value.source !== "folder"
  ) {
    return false
  }
  if (value.folderFingerprint !== undefined && typeof value.folderFingerprint !== "string") {
    return false
  }
  if (value.folderName !== undefined && typeof value.folderName !== "string") {
    return false
  }
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getDb()
    const userId = await getUserId(req)

    if (req.method === "POST") {
      if (!isCreateBody(req.body)) {
        error(res, 400, "bad_request", "Invalid request body")
        return
      }

      const body = req.body
      const fingerprint = body.folderFingerprint?.trim()

      if (fingerprint) {
        const existing = await db.execute({
          sql: "SELECT * FROM projects WHERE owner_id = ? AND folder_fingerprint = ? LIMIT 1",
          args: [userId, fingerprint],
        })
        if (existing.rows.length > 0) {
          const match = rowToRecord(existing.rows[0])
          res.status(409).json({
            error: {
              code: "duplicate_fingerprint",
              message: "A project with this folder fingerprint already exists",
              shareCode: match.shareCode,
              name: match.name,
              updatedAt: match.updatedAt,
            },
          })
          return
        }
      }

      const now = Date.now()
      const shareCode = await createUniqueShareCode()
      const record: ProjectRecord = {
        shareCode,
        name: body.name.trim() || "Untitled project",
        ciphertext: body.ciphertext,
        iv: body.iv,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
        environmentCount: body.environmentCount,
        environmentFilenames: body.environmentFilenames,
        source: body.source ?? "manual",
        ...(fingerprint ? { folderFingerprint: fingerprint } : {}),
        ...(body.folderName ? { folderName: body.folderName } : {}),
      }

      const placeholders = PROJECT_COLUMNS.map(() => "?").join(", ")
      await db.execute({
        sql: `INSERT INTO projects (${PROJECT_COLUMNS.join(", ")}) VALUES (${placeholders})`,
        args: recordToInsert(record),
      })

      json(res, 201, toMetaResponse(record))
      return
    }

    if (req.method === "GET") {
      const result = await db.execute({
        sql: "SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC",
        args: [userId],
      })
      const projects = result.rows.map((row) => toMetaResponse(rowToRecord(row)))
      json(res, 200, { projects })
      return
    }

    error(res, 405, "method_not_allowed", "Method not allowed")
  } catch (err) {
    if (err instanceof AuthError) {
      error(res, 401, "unauthorized", err.message)
      return
    }
    error(
      res,
      500,
      "internal_error",
      err instanceof Error ? err.message : "Unexpected server error",
    )
  }
}
