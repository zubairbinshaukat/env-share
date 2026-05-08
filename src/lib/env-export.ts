/** Serialize and export env variables to .env format. */

import type { EnvVariable } from "@/lib/types"

const NEEDS_QUOTING = /[\s"'#$\\]/

function escapeDouble(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
}

export function serializeVariable({ key, value }: EnvVariable): string {
  if (value === "") return `${key}=`
  if (NEEDS_QUOTING.test(value)) {
    return `${key}="${escapeDouble(value)}"`
  }
  return `${key}=${value}`
}

export function serializeEnv(variables: EnvVariable[]): string {
  return variables.map(serializeVariable).join("\n")
}

export function downloadEnvFile(filename: string, contents: string): void {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, "_") || ".env"
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = safeName
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Defer revoke to allow the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement("textarea")
  ta.value = text
  ta.setAttribute("readonly", "")
  ta.style.position = "fixed"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand("copy")
  } finally {
    ta.remove()
  }
}
