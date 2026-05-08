import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useApi } from "@/lib/api"
import {
  getLegacyProjectCount,
  isMigrationDone,
  markMigrationDone,
  runMigration,
} from "@/lib/migration"
import { useProjectsStore } from "@/store/projects-store"

export function MigrationPrompt() {
  const api = useApi()
  const fetchProjects = useProjectsStore((s) => s.fetchProjects)
  const initialCount = isMigrationDone() ? 0 : getLegacyProjectCount()
  const [open, setOpen] = useState(initialCount > 0)
  const [count] = useState(initialCount)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)

  const progressLabel = useMemo(() => {
    if (!progress) return null
    return `Importing ${progress.done} of ${progress.total}...`
  }, [progress])

  async function handleImport() {
    setBusy(true)
    try {
      await runMigration(api, (done, total) => setProgress({ done, total }))
      await fetchProjects(api)
      setOpen(false)
      toast.success("Projects imported")
    } catch (err) {
      toast.error("Migration failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  function handleSkip() {
    markMigrationDone()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy ? setOpen(next) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import local projects?</DialogTitle>
          <DialogDescription>
            We found {count} local project{count === 1 ? "" : "s"}. Import to your
            account?
          </DialogDescription>
        </DialogHeader>
        {progressLabel ? (
          <p className="text-sm text-muted-foreground">{progressLabel}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={handleSkip}>
            Skip
          </Button>
          <Button disabled={busy} onClick={handleImport}>
            {busy ? "Importing..." : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
