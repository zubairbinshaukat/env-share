import type { VercelRequest, VercelResponse } from "@vercel/node"

import { AuthError, getUserId } from "../_lib/auth"
import { error, json } from "../_lib/http"
import { redis } from "../_lib/redis"
import { createUniqueShareCode } from "../_lib/share-code"

interface ProjectRecord {
  shareCode: string
  name: string
  ciphertext: string
  iv: string
  ownerId: string
  createdAt: number
  updatedAt: number
}

function isCreateBody(body: unknown): body is {
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
  try {
    const userId = await getUserId(req)

    if (req.method === "POST") {
      if (!isCreateBody(req.body)) {
        error(res, 400, "bad_request", "Invalid request body")
        return
      }

      const now = Date.now()
      const shareCode = await createUniqueShareCode()
      const record: ProjectRecord = {
        shareCode,
        name: req.body.name.trim() || "Untitled project",
        ciphertext: req.body.ciphertext,
        iv: req.body.iv,
        ownerId: userId,
        createdAt: now,
        updatedAt: now,
      }

      await redis.set(`project:${shareCode}`, record)
      await redis.sadd(`user:${userId}:projects`, shareCode)

      json(res, 201, {
        shareCode,
        name: record.name,
        createdAt: now,
        updatedAt: now,
      })
      return
    }

    if (req.method === "GET") {
      const codes = (await redis.smembers<string>(`user:${userId}:projects`)) ?? []
      if (codes.length === 0) {
        json(res, 200, { projects: [] })
        return
      }

      const keys = codes.map((code) => `project:${code}`)
      const records = await redis.mget<ProjectRecord[]>(...keys)
      const projects = (records ?? [])
        .filter((record): record is ProjectRecord => Boolean(record))
        .filter((record) => record.ownerId === userId)
        .map((record) => ({
          shareCode: record.shareCode,
          name: record.name,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }))
        .sort((a, b) => b.createdAt - a.createdAt)

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
