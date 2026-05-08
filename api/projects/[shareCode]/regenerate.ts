import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../../_lib/auth"
import { error, json } from "../../_lib/http"
import { toMetaResponse, type ProjectRecord } from "../../_lib/project-record"
import { getRedis } from "../../_lib/redis"
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
    const redis = getRedis()
    const userId = await getUserId(req)
    const oldKey = `project:${shareCode}`
    const project = await redis.get<ProjectRecord>(oldKey)

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

    await redis.set(`project:${newShareCode}`, updated)
    await redis.sadd(`user:${userId}:projects`, newShareCode)
    await redis.del(oldKey)
    await redis.srem(`user:${userId}:projects`, shareCode)

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
