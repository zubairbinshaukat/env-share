import { Check, Copy, MoreHorizontal } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import { ProjectMenuContent } from "@/components/projects/project-menu"
import { RegenerateDialog } from "@/components/projects/regenerate-dialog"
import { SourceBadge } from "@/components/projects/source-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useApi } from "@/lib/api"
import { copyToClipboard } from "@/lib/env-export"
import { projectGradientFor } from "@/lib/project-gradient"
import { buildShareUrl } from "@/lib/share-link"
import type { ProjectMeta } from "@/lib/types"
import { cn, timeAgo } from "@/lib/utils"
import { readProjectKey, useProjectsStore } from "@/store/projects-store"

interface ProjectCardProps {
  project: ProjectMeta
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const api = useApi()
  const patchProject = useProjectsStore((s) => s.patchProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const duplicateProject = useProjectsStore((s) => s.duplicateProject)
  const regenerateShareCode = useProjectsStore((s) => s.regenerateShareCode)

  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)

  const open = () => navigate(`/project/${project.shareCode}`)
  const envCount = project.environmentCount ?? 0
  const gradient = projectGradientFor(project)

  async function handleCopyShareCode() {
    try {
      const key = readProjectKey(project.shareCode)
      if (!key) {
        toast.error("Encryption key not found on this device")
        return
      }
      await copyToClipboard(buildShareUrl(project.shareCode, key))
      setCopied(true)
      toast.success("Share link copied")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy share code")
    }
  }

  async function handleRename() {
    const trimmed = renameValue.trim()
    if (!trimmed) {
      toast.warning("Project name can't be empty")
      return
    }
    if (trimmed.length > 60) {
      toast.warning("Project name is too long (60 chars max)")
      return
    }
    if (trimmed === project.name) {
      setRenameOpen(false)
      return
    }
    setBusy(true)
    try {
      await patchProject(api, project.shareCode, { name: trimmed })
      toast.success(`Renamed to "${trimmed}"`)
      setRenameOpen(false)
    } catch (err) {
      toast.error("Failed to rename", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteProject(api, project.shareCode)
      toast.success("Project deleted")
      setDeleteOpen(false)
    } catch (err) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
      setBusy(false)
    }
  }

  async function handleDuplicate() {
    setBusy(true)
    try {
      const created = await duplicateProject(api, project.shareCode)
      toast.success(`Duplicated as "${created.name}"`)
    } catch (err) {
      toast.error("Failed to duplicate", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    setBusy(true)
    try {
      const updated = await regenerateShareCode(api, project.shareCode)
      const newKey = readProjectKey(updated.shareCode)
      setRegenerateOpen(false)
      if (newKey) {
        try {
          await copyToClipboard(buildShareUrl(updated.shareCode, newKey))
          toast.success("New share link generated", {
            description: "Copied to clipboard",
          })
        } catch {
          toast.success("New share link generated")
        }
      } else {
        toast.success("New share link generated")
      }
    } catch (err) {
      toast.error("Failed to regenerate link", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  function startRename() {
    setRenameValue(project.name)
    setRenameOpen(true)
  }

  function stopProp(event: React.MouseEvent | React.KeyboardEvent) {
    event.stopPropagation()
  }

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            open()
          }
        }}
        style={{ backgroundImage: gradient }}
        className={cn(
          "group/card relative cursor-pointer gap-0 transition-all duration-150",
          "hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]",
          "focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/30",
        )}
      >
        <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="More project actions"
                disabled={busy}
                onClick={stopProp}
                onKeyDown={stopProp}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <ProjectMenuContent
              project={project}
              context="card"
              busy={busy}
              onOpen={open}
              onCopyShareLink={handleCopyShareCode}
              onRename={startRename}
              onDuplicate={handleDuplicate}
              onRegenerate={() => setRegenerateOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          </DropdownMenu>
        </div>

        <div className="space-y-1.5 pr-8">
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
            {project.name}
          </h3>
          <div className="flex items-center gap-2">
            <SourceBadge project={project} showLabel={false} />
            <p className="truncate text-[13px] text-muted-foreground">
              {envCount} {envCount === 1 ? "environment" : "environments"} ·{" "}
              {timeAgo(project.updatedAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <code className="truncate rounded-full bg-muted px-3 py-1 font-mono text-[12px] text-muted-foreground">
            {project.shareCode}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? "Copied" : "Copy share link"}
            onClick={(event) => {
              event.stopPropagation()
              handleCopyShareCode()
            }}
            className="shrink-0"
          >
            {copied ? (
              <Check className="size-4 text-primary" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </div>
      </Card>

      <Dialog
        open={renameOpen}
        onOpenChange={(next) => {
          if (busy) return
          setRenameOpen(next)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Pick a clear, recognizable name. Up to 60 characters.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleRename()
              if (event.key === "Escape") setRenameOpen(false)
            }}
            maxLength={60}
            className="h-10 w-full rounded-[length:var(--radius-input)] border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" loading={busy} onClick={handleRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectName={project.name}
        onConfirm={handleDelete}
        busy={busy}
      />

      <RegenerateDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onConfirm={handleRegenerate}
        busy={busy}
      />
    </>
  )
}
