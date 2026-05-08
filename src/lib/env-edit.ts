import { serializeEnv } from "@/lib/env-export"
import { parseEnv } from "@/lib/env-parser"
import type { EnvVariable, ProjectEnvironment } from "@/lib/types"

/** Convert a project environment into a multiline textarea body. */
export function envToBody(env: ProjectEnvironment): string {
  return serializeEnv(env.variables)
}

/** Parse a textarea body into env variables. */
export function bodyToEnvVariables(body: string): EnvVariable[] {
  return parseEnv(body)
}
