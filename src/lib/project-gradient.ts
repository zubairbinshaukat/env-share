import type { ProjectMeta } from "@/lib/types"

/**
 * Deterministic, soft per-project gradient — no hardcoded colors.
 *
 * The gradient is derived purely from a string key, so the same key always
 * yields the same gradient and projects that share a parent directory share a
 * gradient. Colors are generated in HSL with low saturation/alpha so the result
 * stays soft and reads well over both light and dark card surfaces.
 */

/** FNV-1a style string hash → unsigned 32-bit int. */
function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Key that decides a project's gradient. Projects under the same parent folder
 * (e.g. `lighthouse/frontend`, `lighthouse/backend`) share the parent segment
 * (`lighthouse`) and therefore the same gradient. Falls back to the folder or
 * project name for simple/manual projects.
 */
export function projectGradientKey(
  project: Pick<ProjectMeta, "name" | "folderName">,
): string {
  const base = project.folderName ?? project.name ?? ""
  const parent = base.split("/")[0]?.trim()
  return (parent || base || project.name || "project").toLowerCase()
}

/** Build a soft two-tone gradient (a corner glow + a faint diagonal wash). */
export function projectGradient(key: string): string {
  const hash = hashString(key)
  const hue = hash % 360
  // A gently analogous second hue keeps the blend calm, never clashing.
  const hue2 = (hue + 34) % 360
  return [
    `radial-gradient(120% 120% at 0% 0%, hsl(${hue} 70% 64% / 0.18), transparent 55%)`,
    `linear-gradient(135deg, hsl(${hue} 64% 62% / 0.12), hsl(${hue2} 66% 60% / 0.07))`,
  ].join(", ")
}

/** Convenience: gradient straight from a project. */
export function projectGradientFor(
  project: Pick<ProjectMeta, "name" | "folderName">,
): string {
  return projectGradient(projectGradientKey(project))
}
