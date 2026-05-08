import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { copyToClipboard } from "@/lib/env-export"
import { buildShareUrl } from "@/lib/share-link"
import type { ProjectMeta } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return "—"
  }
}

interface ProjectCardProps {
  project: ProjectMeta
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const open = () => navigate(`/project/${project.shareCode}`)

  const handleCopyShareCode = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const key = window.localStorage.getItem(`project_key_${project.shareCode}`)
      if (!key) {
        toast.error("Encryption key not found on this device")
        return
      }
      await copyToClipboard(buildShareUrl(project.shareCode, key))
      setCopied(true)
      toast.success("Share link copied", {
        description: project.shareCode,
      })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy share code")
    }
  }

  return (
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
      className={cn(
        "cursor-pointer gap-3 py-4 transition-all duration-150",
        "hover:ring-foreground/20 hover:-translate-y-px",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Encrypted project
          </div>
          <h3 className="truncate font-heading text-[15px] font-medium leading-tight text-foreground">
            {project.name}
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 pt-1 text-xs text-muted-foreground">
        <span>Created {formatDate(project.createdAt)}</span>
      </div>

      <div className="mx-4 mt-1 flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Code
          </span>
          <code className="truncate font-mono text-[12px] text-foreground">
            {project.shareCode}
          </code>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Copy share code"
          onClick={handleCopyShareCode}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
    </Card>
  )
}
