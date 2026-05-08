import { AnimatePresence, motion } from "framer-motion"
import { FolderOpen, Plus, Trash2 } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/lib/api"
import { parseEnv } from "@/lib/env-parser"
import {
  isFolderPickerSupported,
  pickDirectoryHandle,
  ScanLimitError,
  scanDirectoryForEnvFiles,
  type FolderScanResult,
} from "@/lib/folder-import"
import { generateUuid } from "@/lib/local"
import type { ProjectEnvironment } from "@/lib/types"
import { useProjectsStore } from "@/store/projects-store"

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: "folder" | "manual"
}

interface ManualDraft {
  id: string
  filename: string
  body: string
}

function makeDraft(): ManualDraft {
  return { id: generateUuid(), filename: ".env", body: "" }
}

export function NewProjectDialog({
  open,
  onOpenChange,
  initialTab = "folder",
}: NewProjectDialogProps) {
  const api = useApi()
  const navigate = useNavigate()
  const createProject = useProjectsStore((s) => s.createProject)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<"folder" | "manual">(initialTab)
  const [scanResult, setScanResult] = useState<FolderScanResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manualName, setManualName] = useState("")
  const [drafts, setDrafts] = useState<ManualDraft[]>([makeDraft()])
  const [scanProgress, setScanProgress] = useState<{
    foundFiles: number
    scannedFolders: number
  } | null>(null)

  function reset() {
    setTab(initialTab)
    setScanResult(null)
    setSelected(new Set())
    setManualName("")
    setDrafts([makeDraft()])
    setScanProgress(null)
    setBusy(false)
  }

  function onDialogChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSelectFolder() {
    if (!isFolderPickerSupported()) {
      toast.error("Folder picker is not supported in this browser")
      return
    }

    setBusy(true)
    setScanProgress({ foundFiles: 0, scannedFolders: 0 })
    try {
      const handle = await pickDirectoryHandle()
      const result = await scanDirectoryForEnvFiles(handle, {
        onProgress: (progress) =>
          setScanProgress({
            foundFiles: progress.foundFiles,
            scannedFolders: progress.scannedFolders,
          }),
      })
      setScanResult(result)
      setSelected(new Set(result.candidates.map((candidate) => candidate.id)))
      if (result.candidates.length === 0) {
        toast.warning("No .env files found in selected folder")
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (!isAbort) {
        if (err instanceof ScanLimitError) {
          toast.error(err.message)
        } else {
          toast.error("Could not scan folder")
        }
      }
    } finally {
      setBusy(false)
    }
  }

  function toEnv(filename: string, body: string): ProjectEnvironment {
    return {
      id: generateUuid(),
      filename: filename.trim() || ".env",
      variables: parseEnv(body),
    }
  }

  async function handleManualCreate() {
    const name = manualName.trim()
    if (!name) return toast.warning("Project needs a name")

    const environments = drafts
      .map((draft) => toEnv(draft.filename, draft.body))
      .filter((env) => env.variables.length > 0)
    if (environments.length === 0) return toast.warning("Add at least one variable")

    setBusy(true)
    try {
      const project = await createProject(api, { name, environments })
      toast.success(`Created "${project.name}"`)
      onDialogChange(false)
      navigate(`/project/${project.shareCode}`)
    } catch (err) {
      toast.error("Failed to create project", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleFolderImport() {
    if (!scanResult) return
    const candidates = scanResult.candidates.filter((candidate) =>
      selected.has(candidate.id),
    )
    if (candidates.length === 0) return toast.warning("Pick at least one folder")

    setBusy(true)
    try {
      let firstShareCode: string | null = null
      for (const candidate of candidates) {
        const project = await createProject(api, {
          name: candidate.folderName,
          environments: candidate.environments.map((env) => ({
            id: generateUuid(),
            filename: env.filename,
            variables: env.variables,
          })),
        })
        if (!firstShareCode) firstShareCode = project.shareCode
      }
      toast.success(
        candidates.length === 1
          ? "Imported 1 project"
          : `Imported ${candidates.length} projects`,
      )
      onDialogChange(false)
      if (firstShareCode) navigate(`/project/${firstShareCode}`)
    } catch (err) {
      toast.error("Failed to import projects", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Import .env files from a folder, or paste variables manually.
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "folder" | "manual")}
          className="mt-1"
        >
          <TabsList>
            <TabsTrigger value="folder">From folder</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <AnimatePresence mode="wait" initial={false}>
            {tab === "folder" ? (
              <motion.div key="folder" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TabsContent value="folder" forceMount className="space-y-4">
                  {!scanResult ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-8 text-center">
                      <FolderOpen className="mx-auto size-8 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        Scan a folder for .env files.
                      </p>
                      {busy && scanProgress ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Scanning... found {scanProgress.foundFiles} files in{" "}
                          {scanProgress.scannedFolders} folders
                        </p>
                      ) : null}
                      <Button className="mt-4" onClick={handleSelectFolder} disabled={busy}>
                        {busy ? "Scanning..." : "Select folder"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/70 p-2">
                        {scanResult.candidates.map((candidate) => (
                          <label
                            key={candidate.id}
                            className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(candidate.id)}
                              onChange={() =>
                                setSelected((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(candidate.id)) next.delete(candidate.id)
                                  else next.add(candidate.id)
                                  return next
                                })
                              }
                            />
                            <div>
                              <p className="text-sm font-medium">{candidate.folderName}</p>
                              <p className="text-xs text-muted-foreground">
                                {candidate.environments.length} env file(s)
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setScanResult(null)} disabled={busy}>
                          Pick again
                        </Button>
                        <Button onClick={handleFolderImport} disabled={busy}>
                          {busy ? "Importing..." : "Import selected"}
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </motion.div>
            ) : (
              <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TabsContent value="manual" forceMount>
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      handleManualCreate()
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-project-name">Project name</Label>
                      <Input
                        id="manual-project-name"
                        value={manualName}
                        onChange={(event) => setManualName(event.target.value)}
                        placeholder="my-app"
                      />
                    </div>
                    <div className="space-y-3">
                      {drafts.map((draft, index) => (
                        <div key={draft.id} className="space-y-2 rounded-xl border border-border/70 p-3">
                          <div className="flex items-center gap-2">
                            <Input
                              value={draft.filename}
                              onChange={(event) =>
                                setDrafts((prev) =>
                                  prev.map((item) =>
                                    item.id === draft.id
                                      ? { ...item, filename: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              aria-label={`Environment ${index + 1} filename`}
                              className="font-mono text-[13px]"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={drafts.length === 1}
                              onClick={() =>
                                setDrafts((prev) => prev.filter((item) => item.id !== draft.id))
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            rows={6}
                            spellCheck={false}
                            value={draft.body}
                            onChange={(event) =>
                              setDrafts((prev) =>
                                prev.map((item) =>
                                  item.id === draft.id ? { ...item, body: event.target.value } : item,
                                ),
                              )
                            }
                            className="font-mono text-[12.5px]"
                          />
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDrafts((prev) => [...prev, makeDraft()])}
                    >
                      <Plus className="size-3.5" />
                      Add another environment
                    </Button>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={busy}>
                        {busy ? "Creating..." : "Create project"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
