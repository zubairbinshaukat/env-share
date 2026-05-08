import type { VercelRequest, VercelResponse } from "@vercel/node"

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    error(res, 405, "method_not_allowed", "Method not allowed")
    return
  }

  const shareCode = String(req.query.shareCode ?? "").trim()
  if (!shareCode) {
    error(res, 400, "bad_request", "Missing shareCode")
    return
  }

  try {
    const project = await redis.get<ProjectRecord>(`project:${shareCode}`)
    if (!project) {
      error(res, 404, "not_found", "Project not found")
      return
    }

    json(res, 200, {
      shareCode: project.shareCode,
      name: project.name,
      ciphertext: project.ciphertext,
      iv: project.iv,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })
  } catch {
    error(res, 500, "internal_error", "Unexpected server error")
  }
}
