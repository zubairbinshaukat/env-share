/**
 * Folder scanning via the File System Access API.
 * Recursively finds files matching `.env*`, groups them by parent folder,
 * and parses them into `ProjectEnvironment` previews.
 */

import { parseEnv } from "@/lib/env-parser"
import { generateUuid } from "@/lib/local"
import type { ProjectEnvironment } from "@/lib/types"

/** Folders we never recurse into; common high-volume noise. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  ".vercel",
  ".idea",
  ".vscode",
  "dist",
  "build",
  "out",
  "coverage",
  ".DS_Store",
  "__pycache__",
])

const ENV_FILE_RE = /^\.env(\..+)?$/

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
}

async function scanDir(
  handle: FileSystemDirectoryHandle,
  relativePath: string,
  ctx: ScanContext,
): Promise<void> {
  let entries: AsyncIterable<[string, FileSystemHandle]>
  try {
    // `entries()` is iterable on FileSystemDirectoryHandle (spec).
    entries = (
      handle as FileSystemDirectoryHandle & {
        entries: () => AsyncIterable<[string, FileSystemHandle]>
      }
    ).entries()
  } catch (err) {
    ctx.warnings.push(
      `Could not read folder "${relativePath || handle.name}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return
  }

  for await (const [name, child] of entries) {
    if (child.kind === "directory") {
      if (SKIP_DIRS.has(name) || name.startsWith(".env")) {
        // Skip noisy folders, plus folders literally named `.env*`.
        continue
      }
      const childPath = relativePath ? `${relativePath}/${name}` : name
      try {
        await scanDir(child as FileSystemDirectoryHandle, childPath, ctx)
      } catch (err) {
        ctx.warnings.push(
          `Skipped "${childPath}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
      }
      continue
    }

    if (child.kind !== "file") continue
    if (!ENV_FILE_RE.test(name)) continue

    try {
      const file = await (child as FileSystemFileHandle).getFile()
      const text = await file.text()
      const variables = parseEnv(text)

      const folderKey = relativePath || handle.name
      const folderName =
        relativePath === ""
          ? handle.name
          : (relativePath.split("/").pop() ?? handle.name)

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
        filename: name,
        variables,
      })
    } catch (err) {
      ctx.warnings.push(
        `Failed to read "${
          relativePath ? `${relativePath}/${name}` : name
        }": ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}

export async function scanDirectoryForEnvFiles(
  root: FileSystemDirectoryHandle,
): Promise<FolderScanResult> {
  const ctx: ScanContext = { warnings: [], byFolder: new Map() }
  await scanDir(root, "", ctx)

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
