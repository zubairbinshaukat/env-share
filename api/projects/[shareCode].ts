import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../_lib/auth"
import { error, json } from "../_lib/http"
import { redis } from "../_lib/redis"

interface ProjectRecord {
  shareCode: string
  name: string
  ciphertext: string
  iv: string
  ownerId: string
  createdAt: number
  updatedAt: number
}

function isUpdateBody(body: unknown): body is {
  name: string
  ciphertext: string
  iv: string
} {
  if (!body || typeof body !== "object") return false
  const value = body as Record<string, unknown>
  return (
    typeof value.name === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.iv === "string"
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const shareCode = String(req.query.shareCode ?? "").trim()
  if (!shareCode) {
    error(res, 400, "bad_request", "Missing shareCode")
    return
  }

  try {
    const userId = await getUserId(req)
    const key = `project:${shareCode}`
    const project = await redis.get<ProjectRecord>(key)

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
        shareCode: project.shareCode,
        name: project.name,
        ciphertext: project.ciphertext,
        iv: project.iv,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
      return
    }

    if (req.method === "PUT") {
      if (!isUpdateBody(req.body)) {
        error(res, 400, "bad_request", "Invalid request body")
        return
      }
      const updated: ProjectRecord = {
        ...project,
        name: req.body.name.trim() || project.name,
        ciphertext: req.body.ciphertext,
        iv: req.body.iv,
        updatedAt: Date.now(),
      }
      await redis.set(key, updated)
      json(res, 200, {
        shareCode: updated.shareCode,
        name: updated.name,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      })
      return
    }

    if (req.method === "DELETE") {
      await redis.del(key)
      await redis.srem(`user:${userId}:projects`, shareCode)
      res.status(204).end()
      return
    }

    error(res, 405, "method_not_allowed", "Method not allowed")
  } catch (err) {
    if (err instanceof AuthError) {
      error(res, 401, "unauthorized", err.message)
      return
    }
    error(res, 500, "internal_error", "Unexpected server error")
  }
}
