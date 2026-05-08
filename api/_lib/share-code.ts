import { customAlphabet } from "nanoid"

import { getRedis } from "./redis"

const generate = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8)

export async function createUniqueShareCode(): Promise<string> {
  const redis = getRedis()
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generate()
    const exists = await redis.exists(`project:${code}`)
    if (!exists) return code
  }
  throw new Error("Failed to generate a unique share code")
}
