/**
 * Folder scanning via the File System Access API.
 * Uses queue-based BFS with strict safety limits to avoid deep recursion,
 * large directory traversals, and memory blowups.
 */

import { parseEnv } from "@/lib/env-parser"
import { generateUuid } from "@/lib/local"
import type { ProjectEnvironment } from "@/lib/types"

/** Folders we never recurse into; hard safety deny-list. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vite",
  ".svelte-kit",
  ".astro",
  ".parcel-cache",
  ".pnpm-store",
  "dist",
  "build",
  "out",
  ".cache",
  ".vercel",
  ".turbo",
  "coverage",
  ".nuxt",
  ".output",
  "vendor",
  "target",
  ".venv",
  "venv",
  "__pycache__",
  ".DS_Store",
  ".idea",
  ".vscode",
])

const ENV_FILE_RE = /^\.env(\..+)?$/
const MAX_DEPTH = 4
const MAX_FILES_SCANNED = 5000

export interface FolderScanCandidate {
  /** Stable id for UI selection. */
  id: string
  /** Folder name shown to the user — derived from path segment. */
  folderName: string
  /** Path relative to the originally selected folder, e.g. "apps/web". */
  relativePath: string
  /** Parsed environments (one per `.env*` file found in this folder). */
  environments: ProjectEnvironment[]
}

export interface FolderScanResult {
  /** Name of the root folder the user selected. */
  rootName: string
  /** One entry per parent folder that contained at least one `.env*` file. */
  candidates: FolderScanCandidate[]
  /** Non-fatal warnings encountered (e.g., unreadable subtree). */
  warnings: string[]
}

/** Returns true if FS Access API is available in this browser. */
export function isFolderPickerSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

/**
 * Stable fingerprint for a candidate folder, scoped to its repo so the same
 * leaf name in different repos does not collide (e.g. `lighthouse/apps/frontend`
 * vs `env-share/apps/frontend`). Hashes the scan root name + the folder's path
 * relative to that root + the sorted `.env*` filenames. Re-scanning the same
 * folder from the same root reproduces the fingerprint; changing the file set,
 * the folder's location, or the selected root changes it.
 */
export async function computeFolderFingerprint(
  rootName: string,
  relativePath: string,
  filenames: string[],
): Promise<string> {
  const sorted = [...filenames].sort()
  const input = [rootName, relativePath || ".", ...sorted].join("|")
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0")
  }
  return out
}

/**
 * Open the directory picker. Throws DOMException("AbortError") if user cancels.
 */
export async function pickDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
  if (!isFolderPickerSupported()) {
    throw new Error("Folder picker is not supported in this browser.")
  }
  // The cast is needed because `showDirectoryPicker` is not in the lib.dom types yet on all targets.
  const w = window as typeof window & {
    showDirectoryPicker: (
      opts?: { mode?: "read" | "readwrite"; id?: string },
    ) => Promise<FileSystemDirectoryHandle>
  }
  return await w.showDirectoryPicker({ mode: "read" })
}

interface ScanContext {
  warnings: string[]
  /** Map from full relative folder path → candidate (built up during scan). */
  byFolder: Map<string, FolderScanCandidate>
  scannedFolders: number
  matchedFiles: number
  scannedFiles: number
}

export class ScanLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScanLimitError"
  }
}

interface QueueItem {
  handle: FileSystemDirectoryHandle
  relativePath: string
  depth: number
}

function updateCandidateForEnv(
  ctx: ScanContext,
  rootName: string,
  relativePath: string,
  filename: string,
  text: string,
): void {
  const folderKey = relativePath || rootName
  const folderName =
    relativePath === "" ? rootName : (relativePath.split("/").pop() ?? rootName)

  let candidate = ctx.byFolder.get(folderKey)
  if (!candidate) {
    candidate = {
      id: generateUuid(),
      folderName,
      relativePath: relativePath || ".",
      environments: [],
    }
    ctx.byFolder.set(folderKey, candidate)
  }
  candidate.environments.push({
    id: generateUuid(),
    filename,
    variables: parseEnv(text),
  })
}

async function scanWithBfs(
  root: FileSystemDirectoryHandle,
  ctx: ScanContext,
  onProgress?: (progress: {
    foundFiles: number
    scannedFolders: number
    scannedFiles: number
  }) => void,
): Promise<void> {
  const queue: QueueItem[] = [{ handle: root, relativePath: "", depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift() as QueueItem
    ctx.scannedFolders += 1
    onProgress?.({
      foundFiles: ctx.matchedFiles,
      scannedFolders: ctx.scannedFolders,
      scannedFiles: ctx.scannedFiles,
    })

    let entries: AsyncIterable<[string, FileSystemHandle]>
    try {
      entries = (
        current.handle as FileSystemDirectoryHandle & {
          entries: () => AsyncIterable<[string, FileSystemHandle]>
        }
      ).entries()
    } catch (err) {
      ctx.warnings.push(
        `Could not read folder "${current.relativePath || current.handle.name}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      continue
    }

    for await (const [name, child] of entries) {
      if (child.kind === "directory") {
        if (SKIP_DIRS.has(name) || name.startsWith(".env")) continue
        if (current.depth >= MAX_DEPTH) continue
        const nextPath = current.relativePath
          ? `${current.relativePath}/${name}`
          : name
        queue.push({
          handle: child as FileSystemDirectoryHandle,
          relativePath: nextPath,
          depth: current.depth + 1,
        })
        continue
      }

      if (child.kind !== "file") continue

      ctx.scannedFiles += 1
      if (ctx.scannedFiles > MAX_FILES_SCANNED) {
        throw new ScanLimitError(
          `Scan aborted after ${MAX_FILES_SCANNED.toLocaleString()} files. Narrow the selected folder.`,
        )
      }
      if (!ENV_FILE_RE.test(name)) continue

      try {
        const file = await (child as FileSystemFileHandle).getFile()
        const text = await file.text()
        updateCandidateForEnv(ctx, root.name, current.relativePath, name, text)
        ctx.matchedFiles += 1
      } catch (err) {
        ctx.warnings.push(
          `Failed to read "${
            current.relativePath ? `${current.relativePath}/${name}` : name
          }": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      onProgress?.({
        foundFiles: ctx.matchedFiles,
        scannedFolders: ctx.scannedFolders,
        scannedFiles: ctx.scannedFiles,
      })
    }
  }
}

export async function scanDirectoryForEnvFiles(
  root: FileSystemDirectoryHandle,
  options?: {
    onProgress?: (progress: {
      foundFiles: number
      scannedFolders: number
      scannedFiles: number
    }) => void
  },
): Promise<FolderScanResult> {
  const ctx: ScanContext = {
    warnings: [],
    byFolder: new Map(),
    scannedFiles: 0,
    scannedFolders: 0,
    matchedFiles: 0,
  }
  await scanWithBfs(root, ctx, options?.onProgress)

  const candidates = Array.from(ctx.byFolder.values())
  // Sort environments inside each candidate by filename for stable display.
  for (const c of candidates) {
    c.environments.sort((a, b) => a.filename.localeCompare(b.filename))
  }
  // Prefer root-level candidate first, then alphabetical relative path.
  candidates.sort((a, b) => {
    if (a.relativePath === ".") return -1
    if (b.relativePath === ".") return 1
    return a.relativePath.localeCompare(b.relativePath)
  })

  return {
    rootName: root.name,
    candidates,
    warnings: ctx.warnings,
  }
}
