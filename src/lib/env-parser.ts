/**
 * Tolerant `.env` parser.
 * Supports:
 *  - blank lines and full-line `#` comments
 *  - `export KEY=value` prefix
 *  - quoted values (single, double); preserves inner content (incl. `=`)
 *  - unquoted values: split on first `=`, strip trailing inline comments
 *  - escape sequences in double-quoted strings: \n, \r, \t, \\, \", \$
 *  - line continuations inside multi-line quoted values
 */

import type { EnvVariable } from "@/lib/types"

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/

function unescapeDouble(input: string): string {
  let out = ""
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "\\" && i + 1 < input.length) {
      const next = input[i + 1]
      switch (next) {
        case "n":
          out += "\n"
          break
        case "r":
          out += "\r"
          break
        case "t":
          out += "\t"
          break
        case "\\":
          out += "\\"
          break
        case '"':
          out += '"'
          break
        case "$":
          out += "$"
          break
        default:
          out += next
      }
      i++
    } else {
      out += ch
    }
  }
  return out
}

/** Strip a trailing inline `#` comment from an unquoted value (only after whitespace). */
function stripTrailingComment(value: string): string {
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd()
    }
  }
  return value.trimEnd()
}

/**
 * Read a quoted string starting *after* the opening quote.
 * `firstChunk` is the remainder of the current source line after that quote.
 * Returns the decoded value and how many additional source lines were consumed.
 */
function readQuoted(
  firstChunk: string,
  followingLines: string[],
  quote: '"' | "'",
): { value: string; extraLines: number } {
  const isDouble = quote === '"'
  const segments: string[] = []
  let extraLines = 0

  let cursor = firstChunk
  while (true) {
    let i = 0
    while (i < cursor.length) {
      const ch = cursor[i]
      if (isDouble && ch === "\\" && i + 1 < cursor.length) {
        i += 2
        continue
      }
      if (ch === quote) {
        segments.push(cursor.slice(0, i))
        const joined = segments.join("\n")
        return { value: isDouble ? unescapeDouble(joined) : joined, extraLines }
      }
      i++
    }
    segments.push(cursor)
    if (extraLines >= followingLines.length) {
      // Unterminated quote — return collected content.
      const joined = segments.join("\n")
      return { value: isDouble ? unescapeDouble(joined) : joined, extraLines }
    }
    cursor = followingLines[extraLines]
    extraLines++
  }
}

export function parseEnv(text: string): EnvVariable[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const out: EnvVariable[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmedStart = raw.replace(/^\s+/, "")
    if (trimmedStart === "" || trimmedStart.startsWith("#")) continue

    let working = trimmedStart
    if (working.startsWith("export ") || working.startsWith("export\t")) {
      working = working.slice("export".length).replace(/^\s+/, "")
    }

    const eqIdx = working.indexOf("=")
    if (eqIdx === -1) continue

    const key = working.slice(0, eqIdx).trim()
    if (!KEY_RE.test(key)) continue

    const valuePart = working.slice(eqIdx + 1).replace(/^[ \t]+/, "")

    let value: string
    if (valuePart.startsWith('"') || valuePart.startsWith("'")) {
      const quote = valuePart[0] as '"' | "'"
      const remainder = valuePart.slice(1)
      const result = readQuoted(remainder, lines.slice(i + 1), quote)
      value = result.value
      i += result.extraLines
    } else {
      value = stripTrailingComment(valuePart)
    }

    out.push({ key, value })
  }

  return out
}
