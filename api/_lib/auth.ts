import type { VercelRequest } from "@vercel/node"
import { verifyToken } from "@clerk/backend"

export class AuthError extends Error {
  status = 401 as const
}

export async function getUserId(req: VercelRequest): Promise<string> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (!clerkSecretKey) {
    throw new Error("Missing CLERK_SECRET_KEY in server environment")
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token")
  }
  const token = auth.slice("Bearer ".length).trim()
  if (!token) {
    throw new AuthError("Missing bearer token")
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>
  try {
    payload = await verifyToken(token, { secretKey: clerkSecretKey })
  } catch {
    throw new AuthError("Invalid or expired token")
  }

  if (!payload || typeof payload.sub !== "string" || !payload.sub) {
    throw new AuthError("Invalid token payload")
  }
  return payload.sub
}
