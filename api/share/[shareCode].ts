import type { VercelRequest, VercelResponse } from "@vercel/node"

import { error, json } from "../_lib/http"
import type { ProjectRecord } from "../_lib/project-record"
import { getRedis } from "../_lib/redis"

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
    const redis = getRedis()
    const project = await redis.get<ProjectRecord>(`project:${shareCode}`)

    if (!project) {
      error(res, 404, "not_found", "Share link not found")
      return
    }

    json(res, 200, {
      shareCode: project.shareCode,
      name: project.name,
      ciphertext: project.ciphertext,
      iv: project.iv,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      environmentCount: project.environmentCount ?? 0,
    })
  } catch (err) {
    error(
      res,
      500,
      "internal_error",
      err instanceof Error ? err.message : "Unexpected server error",
    )
  }
}
