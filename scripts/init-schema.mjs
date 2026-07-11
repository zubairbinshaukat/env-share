/**
 * Create the Turso schema (idempotent). Run once:
 *   node --env-file=.env scripts/init-schema.mjs
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { createClient } from "@libsql/client"

const here = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(here, "..", "api", "_lib", "schema.sql"), "utf8")

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await db.execute(statement)
}
console.log("Schema created.")
