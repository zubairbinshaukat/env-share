const KEY_PARAM = "key"

export interface ParsedShareInput {
  shareCode: string
  key: string | null
}

export function buildShareUrl(shareCode: string, key: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/s/${encodeURIComponent(shareCode)}#${KEY_PARAM}=${encodeURIComponent(key)}`
}

export function getKeyFromHash(hash = window.location.hash): string | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash
  const params = new URLSearchParams(clean)
  const key = params.get(KEY_PARAM)
  return key && key.length > 0 ? key : null
}

export function parseShareInput(value: string): ParsedShareInput | null {
  const input = value.trim()
  if (!input) return null

  try {
    const maybeUrl = new URL(input)
    const parts = maybeUrl.pathname.split("/").filter(Boolean)
    if (parts.length >= 2 && parts[0] === "s") {
      return {
        shareCode: decodeURIComponent(parts[1]),
        key: getKeyFromHash(maybeUrl.hash),
      }
    }
  } catch {
    // not a URL
  }

  return { shareCode: input, key: null }
}
