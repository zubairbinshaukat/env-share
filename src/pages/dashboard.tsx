import { motion } from "framer-motion"
import { FolderPlus, PackageOpen, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { Button } from "@/components/ui/button"
import { useProjectsStore } from "@/store/projects-store"

export function DashboardPage() {
  const projects = useProjectsStore((s) => s.projects)
  const hydrated = useProjectsStore((s) => s.hydrated)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<"folder" | "manual">("folder")

  const sorted = useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects],
  )

  function openDialog(tab: "folder" | "manual") {
    setInitialTab(tab)
    setDialogOpen(true)
  }

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Your projects
          </h1>
        </div>
        <Button type="button" onClick={() => openDialog("folder")}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {hydrated && sorted.length === 0 ? (
        <EmptyState
          onPickFolder={() => openDialog("folder")}
          onPickManual={() => openDialog("manual")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialTab={initialTab}
      />
    </motion.div>
  )
}

function EmptyState({
  onPickFolder,
  onPickManual,
}: {
  onPickFolder: () => void
  onPickManual: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-background ring-1 ring-foreground/10">
        <PackageOpen className="size-5 text-muted-foreground" />
      </div>
      <h2 className="mt-5 font-heading text-base font-medium text-foreground">
        No projects yet
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Import from a folder or create one manually.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={onPickFolder}>
          <FolderPlus className="size-4" />
          Import from folder
        </Button>
        <Button type="button" variant="outline" onClick={onPickManual}>
          <Plus className="size-4" />
          Create manually
        </Button>
      </div>
    </motion.div>
  )
}
