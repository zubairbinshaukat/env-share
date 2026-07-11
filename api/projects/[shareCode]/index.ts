import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../../_lib/auth"
import { getDb, rowToRecord } from "../../_lib/db"
import { error, json } from "../../_lib/http"
import {
  toMetaResponse,
  type ProjectRecord,
  type ProjectSource,
} from "../../_lib/project-record"

interface UpdateBody {
  name?: string
  ciphertext?: string
  iv?: string
  environmentCount?: number
  environmentFilenames?: string[]
  source?: ProjectSource
  folderFingerprint?: string | null
  folderName?: string | null
}

function isUpdateBody(body: unknown): body is UpdateBody {
  if (!body || typeof body !== "object") return false
  const value = body as Record<string, unknown>

  if (value.name !== undefined && typeof value.name !== "string") return false
  if (value.ciphertext !== undefined && typeof value.ciphertext !== "string") {
    return false
  }
  if (value.iv !== undefined && typeof value.iv !== "string") return false
  if (
    value.environmentCount !== undefined &&
    (typeof value.environmentCount !== "number" ||
      !Number.isFinite(value.environmentCount) ||
      value.environmentCount < 0)
  ) {
    return false
  }
  if (
    value.environmentFilenames !== undefined &&
    (!Array.isArray(value.environmentFilenames) ||
      !value.environmentFilenames.every((item) => typeof item === "string"))
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
  if (
    value.folderFingerprint !== undefined &&
    value.folderFingerprint !== null &&
    typeof value.folderFingerprint !== "string"
  ) {
    return false
  }
  if (
    value.folderName !== undefined &&
    value.folderName !== null &&
    typeof value.folderName !== "string"
  ) {
    return false
  }

  // ciphertext + iv must change together with both env count and filenames.
  const hasCipher = value.ciphertext !== undefined || value.iv !== undefined
  const hasCount = value.environmentCount !== undefined
  const hasFilenames = value.environmentFilenames !== undefined
  if (hasCipher && (!hasCount || !hasFilenames)) return false
  if ((hasCount || hasFilenames) && !hasCipher) return false

  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareCode = String(req.query.shareCode ?? "").trim()
  if (!shareCode) {
    error(res, 400, "bad_request", "Missing shareCode")
    return
  }

  try {
    const db = getDb()
    const userId = await getUserId(req)
    const found = await db.execute({
      sql: "SELECT * FROM projects WHERE share_code = ?",
      args: [shareCode],
    })
    const project = found.rows.length > 0 ? rowToRecord(found.rows[0]) : null

    if (!project) {
      error(res, 404, "not_found", "Project not found")
      return
    }
    if (project.ownerId !== userId) {
      error(res, 403, "forbidden", "You do not own this project")
      return
    }

    if (req.method === "GET") {
      json(res, 200, {
        ...toMetaResponse(project),
        ciphertext: project.ciphertext,
        iv: project.iv,
      })
      return
    }

    if (req.method === "PUT") {
      if (!isUpdateBody(req.body)) {
        error(res, 400, "bad_request", "Invalid request body")
        return
      }

      const body = req.body
      const updated: ProjectRecord = {
        ...project,
        name:
          body.name !== undefined
            ? body.name.trim() || project.name
            : project.name,
        ciphertext:
          body.ciphertext !== undefined ? body.ciphertext : project.ciphertext,
        iv: body.iv !== undefined ? body.iv : project.iv,
        environmentCount:
          body.environmentCount !== undefined
            ? body.environmentCount
            : project.environmentCount,
        environmentFilenames:
          body.environmentFilenames !== undefined
            ? body.environmentFilenames
            : project.environmentFilenames,
        source: body.source !== undefined ? body.source : project.source,
        updatedAt: Date.now(),
      }

      if (body.folderFingerprint === null) {
        delete updated.folderFingerprint
      } else if (typeof body.folderFingerprint === "string") {
        updated.folderFingerprint = body.folderFingerprint
      }
      if (body.folderName === null) {
        delete updated.folderName
      } else if (typeof body.folderName === "string") {
        updated.folderName = body.folderName
      }

      await db.execute({
        sql: `UPDATE projects SET
          name = ?,
          ciphertext = ?,
          iv = ?,
          updated_at = ?,
          environment_count = ?,
          environment_filenames = ?,
          source = ?,
          folder_fingerprint = ?,
          folder_name = ?
        WHERE share_code = ?`,
        args: [
          updated.name,
          updated.ciphertext,
          updated.iv,
          updated.updatedAt,
          updated.environmentCount,
          JSON.stringify(updated.environmentFilenames ?? []),
          updated.source,
          updated.folderFingerprint ?? null,
          updated.folderName ?? null,
          shareCode,
        ],
      })
      json(res, 200, toMetaResponse(updated))
      return
    }

    if (req.method === "DELETE") {
      await db.execute({
        sql: "DELETE FROM projects WHERE share_code = ?",
        args: [shareCode],
      })
      res.status(204).end()
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
