import { randomInt } from "node:crypto"

import { getDb } from "./db"

const SHARE_CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
const SHARE_CODE_LENGTH = 8

/**
 * Cryptographically-secure random share code. Replaces nanoid, which is
 * ESM-only (v5) and cannot be require()d by the compiled CommonJS serverless
 * functions on Vercel's Node runtime. randomInt() is unbiased and CSPRNG-backed.
 */
function generate(): string {
  let code = ""
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_ALPHABET[randomInt(SHARE_CODE_ALPHABET.length)]
  }
  return code
}

export async function createUniqueShareCode(): Promise<string> {
  const db = getDb()
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generate()
    const result = await db.execute({
      sql: "SELECT 1 FROM projects WHERE share_code = ? LIMIT 1",
      args: [code],
    })
    if (result.rows.length === 0) return code
  }
  throw new Error("Failed to generate a unique share code")
}
