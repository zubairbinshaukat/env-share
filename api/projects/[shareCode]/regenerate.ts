import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../../_lib/auth"
import {
  getDb,
  PROJECT_COLUMNS,
  recordToInsert,
  rowToRecord,
} from "../../_lib/db"
import { error, json } from "../../_lib/http"
import { toMetaResponse, type ProjectRecord } from "../../_lib/project-record"
import { createUniqueShareCode } from "../../_lib/share-code"

interface RegenerateBody {
  ciphertext: string
  iv: string
}

function isRegenerateBody(body: unknown): body is RegenerateBody {
  if (!body || typeof body !== "object") return false
  const value = body as Record<string, unknown>
  return (
    typeof value.ciphertext === "string" && typeof value.iv === "string"
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    error(res, 405, "method_not_allowed", "Method not allowed")
    return
  }

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
    if (!isRegenerateBody(req.body)) {
      error(res, 400, "bad_request", "Invalid request body")
      return
    }

    const newShareCode = await createUniqueShareCode()
    const now = Date.now()
    const updated: ProjectRecord = {
      ...project,
      shareCode: newShareCode,
      ciphertext: req.body.ciphertext,
      iv: req.body.iv,
      updatedAt: now,
    }

    // Insert the new row and drop the old one atomically so a mid-failure
    // can never leave both share codes live or orphan state.
    const placeholders = PROJECT_COLUMNS.map(() => "?").join(", ")
    await db.batch(
      [
        {
          sql: `INSERT INTO projects (${PROJECT_COLUMNS.join(", ")}) VALUES (${placeholders})`,
          args: recordToInsert(updated),
        },
        {
          sql: "DELETE FROM projects WHERE share_code = ?",
          args: [shareCode],
        },
      ],
      "write",
    )

    json(res, 200, toMetaResponse(updated))
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
