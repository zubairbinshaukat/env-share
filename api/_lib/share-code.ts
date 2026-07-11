import { customAlphabet } from "nanoid"

import { getDb } from "./db"

const generate = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8)

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
