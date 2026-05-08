import {
  Copy,
  CopyPlus,
  ExternalLink,
  KeyRound,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react"

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { ProjectMeta } from "@/lib/types"

export interface ProjectMenuProps {
  project: Pick<ProjectMeta, "shareCode" | "name" | "source">
  context: "card" | "header"
  busy?: boolean
  onOpen?: () => void
  onCopyShareLink: () => void
  onRename: () => void
  onEditEnvs?: () => void
  onRescanFolder?: () => void
  onDuplicate: () => void
  onRegenerate: () => void
  onDelete: () => void
}

export function ProjectMenuContent({
  project,
  context,
  busy = false,
  onOpen,
  onCopyShareLink,
  onRename,
  onEditEnvs,
  onRescanFolder,
  onDuplicate,
  onRegenerate,
  onDelete,
}: ProjectMenuProps) {
  const isFolder = (project.source ?? "manual") === "folder"

  return (
    <DropdownMenuContent>
      {context === "card" && onOpen ? (
        <>
          <DropdownMenuItem onSelect={onOpen}>
            <ExternalLink />
            Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuLabel>Manage</DropdownMenuLabel>
      <DropdownMenuItem onSelect={onCopyShareLink} disabled={busy}>
        <Copy />
        Copy share link
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onRename} disabled={busy}>
        <Pencil />
        Rename
      </DropdownMenuItem>
      {!isFolder && onEditEnvs ? (
        <DropdownMenuItem onSelect={onEditEnvs} disabled={busy}>
          <Pencil />
          Edit environments
        </DropdownMenuItem>
      ) : null}
      {isFolder && onRescanFolder ? (
        <DropdownMenuItem onSelect={onRescanFolder} disabled={busy}>
          <RefreshCcw />
          Re-scan folder
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={onDuplicate} disabled={busy}>
        <CopyPlus />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onRegenerate} disabled={busy}>
        <KeyRound />
        Regenerate share link
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={onDelete}
        disabled={busy}
        variant="destructive"
      >
        <Trash2 />
        Delete project
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
