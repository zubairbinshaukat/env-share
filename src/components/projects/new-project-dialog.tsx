import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { parseEnv } from "@/lib/env-parser"
import {
  isFolderPickerSupported,
  pickDirectoryHandle,
  scanDirectoryForEnvFiles,
  type FolderScanResult,
} from "@/lib/folder-import"
import { cn } from "@/lib/utils"
import { useProjectsStore } from "@/store/projects-store"

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-select a tab when opening the dialog. */
  initialTab?: "folder" | "manual"
}

interface ManualEnvDraft {
  id: string
  filename: string
  body: string
}

function makeDraftId() {
  return `draft-${Math.random().toString(36).slice(2, 10)}`
}

export function NewProjectDialog({
  open,
  onOpenChange,
  initialTab = "folder",
}: NewProjectDialogProps) {
  const navigate = useNavigate()
  const createManualProject = useProjectsStore((s) => s.createManualProject)
  const createFolderProjects = useProjectsStore((s) => s.createFolderProjects)
  const [tab, setTab] = useState<"folder" | "manual">(initialTab)

  const [scanResult, setScanResult] = useState<FolderScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(
    new Set(),
  )

  const [manualName, setManualName] = useState("")
  const [drafts, setDrafts] = useState<ManualEnvDraft[]>([
    { id: makeDraftId(), filename: ".env", body: "" },
  ])

  function resetAll() {
    setScanResult(null)
    setScanning(false)
    setSelectedCandidateIds(new Set())
    setManualName("")
    setDrafts([{ id: makeDraftId(), filename: ".env", body: "" }])
    setTab(initialTab)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll()
    onOpenChange(next)
  }

  async function handleSelectFolder() {
    if (!isFolderPickerSupported()) {
      toast.error("Folder picker not supported", {
        description:
          "Use a Chromium-based browser, or import variables manually instead.",
      })
      return
    }
    setScanning(true)
    try {
      const handle = await pickDirectoryHandle()
      const result = await scanDirectoryForEnvFiles(handle)
      setScanResult(result)
      const ids = new Set<string>(result.candidates.map((c) => c.id))
      setSelectedCandidateIds(ids)

      if (result.candidates.length === 0) {
        toast.message("No .env files found", {
          description: `Scanned "${result.rootName}" — nothing matched .env*.`,
        })
      }
      if (result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} folder(s) skipped`, {
          description: result.warnings.slice(0, 2).join(" · "),
        })
      }
    } catch (err) {
      const isAbort =
        err instanceof DOMException && err.name === "AbortError"
      if (!isAbort) {
        toast.error("Could not scan folder", {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      setScanning(false)
    }
  }

  function toggleCandidate(id: string) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirmFolderImport() {
    if (!scanResult) return
    const selected = scanResult.candidates.filter((c) =>
      selectedCandidateIds.has(c.id),
    )
    if (selected.length === 0) {
      toast.warning("Pick at least one folder to import")
      return
    }
    const inputs = selected.map((c) => ({
      name: c.folderName,
      folderName: c.folderName,
      environments: c.environments.map((env) => ({
        filename: env.filename,
        variables: env.variables,
      })),
    }))
    const created = createFolderProjects(inputs)
    toast.success(
      created.length === 1
        ? `Imported "${created[0].name}"`
        : `Imported ${created.length} projects`,
    )
    handleOpenChange(false)
    if (created.length === 1) navigate(`/project/${created[0].id}`)
  }

  function updateDraft(id: string, patch: Partial<ManualEnvDraft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    )
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      { id: makeDraftId(), filename: "", body: "" },
    ])
  }

  function removeDraft(id: string) {
    setDrafts((prev) =>
      prev.length === 1 ? prev : prev.filter((d) => d.id !== id),
    )
  }

  function handleCreateManual() {
    const name = manualName.trim()
    if (!name) {
      toast.warning("Project needs a name")
      return
    }
    const envs = drafts
      .map((d) => ({
        filename: d.filename.trim() || ".env",
        variables: parseEnv(d.body),
      }))
      .filter((e) => e.variables.length > 0)

    if (envs.length === 0) {
      toast.warning("Add at least one variable")
      return
    }
    const project = createManualProject({ name, environments: envs })
    toast.success(`Created "${project.name}"`)
    handleOpenChange(false)
    navigate(`/project/${project.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Import .env files from a folder, or paste variables manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "folder" | "manual")}
          className="mt-1"
        >
          <TabsList>
            <TabsTrigger value="folder">From folder</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <div className="relative">
            <AnimatePresence mode="wait" initial={false}>
              {tab === "folder" ? (
                <motion.div
                  key="folder"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TabsContent value="folder" forceMount>
                    <FolderTabContent
                      scanning={scanning}
                      scanResult={scanResult}
                      selected={selectedCandidateIds}
                      onPickFolder={handleSelectFolder}
                      onToggle={toggleCandidate}
                      onConfirm={handleConfirmFolderImport}
                      onReset={() => {
                        setScanResult(null)
                        setSelectedCandidateIds(new Set())
                      }}
                    />
                  </TabsContent>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TabsContent value="manual" forceMount>
                    <ManualTabContent
                      name={manualName}
                      onNameChange={setManualName}
                      drafts={drafts}
                      onUpdateDraft={updateDraft}
                      onAddDraft={addDraft}
                      onRemoveDraft={removeDraft}
                      onSubmit={handleCreateManual}
                    />
                  </TabsContent>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function FolderTabContent({
  scanning,
  scanResult,
  selected,
  onPickFolder,
  onToggle,
  onConfirm,
  onReset,
}: {
  scanning: boolean
  scanResult: FolderScanResult | null
  selected: Set<string>
  onPickFolder: () => void
  onToggle: (id: string) => void
  onConfirm: () => void
  onReset: () => void
}) {
  const supported = isFolderPickerSupported()

  if (!scanResult) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-8 text-center">
          <FolderOpen className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-[14px] font-medium text-foreground">
            Select a folder to scan for .env files
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            We scan recursively and never upload your files.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={onPickFolder}
            disabled={!supported || scanning}
          >
            <Folder className="size-4" />
            {scanning ? "Scanning…" : "Select folder"}
          </Button>
          {!supported && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <AlertTriangle className="size-3" />
              Your browser does not support the folder picker.
            </p>
          )}
        </div>
      </div>
    )
  }

  const totalEnvs = scanResult.candidates.reduce(
    (sum, c) => sum + c.environments.length,
    0,
  )

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[13px] font-medium text-foreground">
            Found {totalEnvs} .env file{totalEnvs === 1 ? "" : "s"} in&nbsp;
            <span className="font-mono text-[12px]">
              {scanResult.rootName}
            </span>
          </p>
          <p className="text-[12px] text-muted-foreground">
            {scanResult.candidates.length === 1
              ? "Confirm to import."
              : "Pick which folders to import as separate projects."}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Pick again
        </Button>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-card/40 p-2">
        {scanResult.candidates.map((c) => {
          const isOn = selected.has(c.id)
          return (
            <label
              key={c.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md p-2.5 transition-colors",
                isOn ? "bg-accent/30" : "hover:bg-muted",
              )}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(c.id)}
                className="mt-1 size-3.5 accent-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {c.folderName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {c.relativePath === "." ? "root" : c.relativePath}
                  </span>
                </div>
                <ul className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {c.environments.map((env) => (
                    <li
                      key={env.id}
                      className="rounded bg-muted px-1.5 py-0.5"
                    >
                      {env.filename}
                      <span className="ml-1 text-foreground/70">
                        · {env.variables.length}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[12px] text-muted-foreground">
          {selected.size} of {scanResult.candidates.length} selected
        </span>
        <Button type="button" onClick={onConfirm} disabled={selected.size === 0}>
          Import
        </Button>
      </div>
    </div>
  )
}

function ManualTabContent({
  name,
  onNameChange,
  drafts,
  onUpdateDraft,
  onAddDraft,
  onRemoveDraft,
  onSubmit,
}: {
  name: string
  onNameChange: (v: string) => void
  drafts: ManualEnvDraft[]
  onUpdateDraft: (id: string, patch: Partial<ManualEnvDraft>) => void
  onAddDraft: () => void
  onRemoveDraft: (id: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="manual-project-name">Project name</Label>
        <Input
          id="manual-project-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="my-app"
          autoComplete="off"
          autoFocus
        />
      </div>

      <div className="space-y-3">
        {drafts.map((draft, idx) => (
          <div
            key={draft.id}
            className="space-y-2 rounded-xl border border-border/70 bg-card/40 p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                value={draft.filename}
                onChange={(e) =>
                  onUpdateDraft(draft.id, { filename: e.target.value })
                }
                placeholder=".env"
                className="font-mono text-[13px]"
                aria-label={`Environment ${idx + 1} filename`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRemoveDraft(draft.id)}
                disabled={drafts.length === 1}
                aria-label="Remove environment"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Textarea
              value={draft.body}
              onChange={(e) =>
                onUpdateDraft(draft.id, { body: e.target.value })
              }
              rows={6}
              spellCheck={false}
              placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=sk_..."}
              className="min-h-[140px] resize-y font-mono text-[12.5px] leading-relaxed"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddDraft}
        >
          <Plus className="size-3.5" />
          Add another environment
        </Button>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit">Create project</Button>
      </div>
    </form>
  )
}
