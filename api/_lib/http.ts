import type { VercelResponse } from "@vercel/node"

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body)
}

export function error(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
): void {
  json(res, status, { error: { code, message } })
}
