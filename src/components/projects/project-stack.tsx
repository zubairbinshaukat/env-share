import { Layers } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { ProjectCard } from "@/components/projects/project-card"
import { Card } from "@/components/ui/card"
import { projectGradient } from "@/lib/project-gradient"
import type { ProjectMeta } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ProjectStackProps {
  /** Shared parent directory, e.g. "lighthouse". */
  parentName: string
  /** Projects under that parent (always 2+). */
  projects: ProjectMeta[]
}

/**
 * Collapsed pile of monorepo siblings that share a parent directory. Shows a
 * stacked summary; expands to the full list on hover (desktop) or tap (mobile),
 * from which the user selects an individual project.
 */
export function ProjectStack({ parentName, projects }: ProjectStackProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const gradient = projectGradient(parentName.toLowerCase())
  const count = projects.length
  const envTotal = projects.reduce(
    (sum, project) => sum + (project.environmentCount ?? 0),
    0,
  )

  // Tap-outside closes the expanded panel on touch devices.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div
      ref={ref}
      data-open={open ? "true" : "false"}
      className="group relative"
    >
      {/* Collapsed stacked summary (hidden while hovered or open). */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${parentName} — ${count} projects`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative block w-full text-left transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-hover:pointer-events-none group-hover:scale-[0.98] group-hover:opacity-0",
          "group-data-[open=true]:pointer-events-none group-data-[open=true]:scale-[0.98] group-data-[open=true]:opacity-0",
        )}
      >
        {/* Peeking layers behind the front card imply the stack depth. */}
        <div
          aria-hidden
          className="absolute inset-x-4 -bottom-2 h-full rounded-xl border border-border/40 bg-card"
          style={{ backgroundImage: gradient }}
        />
        <div
          aria-hidden
          className="absolute inset-x-2 -bottom-1 h-full rounded-xl border border-border/60 bg-card"
          style={{ backgroundImage: gradient }}
        />
        <Card
          style={{ backgroundImage: gradient }}
          className="relative gap-0 transition-all duration-150 group-hover:border-primary/40"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers className="size-4" />
            </span>
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {parentName}
            </h3>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            {count} projects · {envTotal}{" "}
            {envTotal === 1 ? "environment" : "environments"}
          </p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {projects.slice(0, 4).map((project) => (
              <code
                key={project.shareCode}
                className="truncate rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {project.name.split("/").pop()}
              </code>
            ))}
            {count > 4 ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                +{count - 4}
              </span>
            ) : null}
          </div>
        </Card>
      </button>

      {/* Expanded panel — visible on hover (desktop) or when open (tap). */}
      <div
        className={cn(
          "absolute left-0 top-0 z-20 w-full origin-top opacity-0 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "pointer-events-none -translate-y-1 scale-[0.98]",
          "group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100",
          "group-data-[open=true]:pointer-events-auto group-data-[open=true]:translate-y-0 group-data-[open=true]:scale-100 group-data-[open=true]:opacity-100",
        )}
      >
        <div className="rounded-xl border border-border/60 bg-popover/95 p-3 shadow-[var(--shadow-modal)] backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
              <Layers className="size-3.5 text-primary" />
              {parentName}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {count} projects
            </span>
          </div>
          <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
            {projects.map((project) => (
              <ProjectCard key={project.shareCode} project={project} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
