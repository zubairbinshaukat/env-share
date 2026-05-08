import { FolderTree, Pencil } from "lucide-react"

import type { ProjectMeta } from "@/lib/types"
import { cn, timeAgo } from "@/lib/utils"

interface SourceBadgeProps {
  project: Pick<ProjectMeta, "source" | "updatedAt" | "folderName">
  showLabel?: boolean
  className?: string
}

export function SourceBadge({
  project,
  showLabel = true,
  className,
}: SourceBadgeProps) {
  const source = project.source ?? "manual"
  const isFolder = source === "folder"
  const Icon = isFolder ? FolderTree : Pencil

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        isFolder
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
        className,
      )}
      title={
        isFolder
          ? `Folder import${project.folderName ? ` · ${project.folderName}` : ""} · synced ${timeAgo(project.updatedAt)}`
          : "Created manually"
      }
    >
      <Icon className="size-3" />
      {showLabel ? (isFolder ? "Folder" : "Manual") : null}
    </span>
  )
}
