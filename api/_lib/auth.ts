import type { VercelRequest } from "@vercel/node"
import { verifyToken } from "@clerk/backend"

const clerkSecretKey = process.env.CLERK_SECRET_KEY

if (!clerkSecretKey) {
  throw new Error("Missing CLERK_SECRET_KEY")
}

export class AuthError extends Error {
  status = 401 as const
}

export async function getUserId(req: VercelRequest): Promise<string> {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AuthError("Missing bearer token")
  }
  const token = auth.slice("Bearer ".length).trim()
  if (!token) {
    throw new AuthError("Missing bearer token")
  }

  const payload = await verifyToken(token, { secretKey: clerkSecretKey })
  if (!payload || typeof payload.sub !== "string" || !payload.sub) {
    throw new AuthError("Invalid token payload")
  }
  return payload.sub
}
