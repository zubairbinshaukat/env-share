import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  FolderOpen,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { DiffView } from "@/components/projects/diff-view"
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
import {
  countDiffChanges,
  diffEnvironments,
  isProjectDiffEmpty,
  type ProjectDiff,
} from "@/lib/env-diff"
import { parseEnv } from "@/lib/env-parser"
import {
  computeFolderFingerprint,
  isFolderPickerSupported,
  pickDirectoryHandle,
  ScanLimitError,
  scanDirectoryForEnvFiles,
  type FolderScanCandidate,
} from "@/lib/folder-import"
import { generateUuid } from "@/lib/local"
import type { ProjectEnvironment, ProjectMeta } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  MissingKeyError,
  useProjectsStore,
} from "@/store/projects-store"

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: "folder" | "manual"
  /**
   * If set, the folder import flow will pre-select this share code as the
   * "expected" sync target for the user (used by "Re-scan folder").
   */
  preferShareCode?: string
}

interface ManualDraft {
  id: string
  filename: string
  body: string
}

type CandidateStatus =
  | { kind: "new" }
  | {
      kind: "up-to-date"
      existing: ProjectMeta
    }
  | {
      kind: "changed"
      existing: ProjectMeta
      diff: ProjectDiff
    }
  | {
      kind: "match-no-key"
      existing: ProjectMeta
    }

interface ResolvedCandidate {
  id: string
  folderName: string
  /** Repo-qualified name: `env-share` at the root, `lighthouse/frontend` when nested. */
  displayName: string
  relativePath: string
  fingerprint: string
  environments: ProjectEnvironment[]
  status: CandidateStatus
  /** True after import/sync completes; used for the done state row label. */
  resolved?: "imported" | "synced" | "skipped"
  resolvedShareCode?: string
}

function makeDraft(): ManualDraft {
  return { id: generateUuid(), filename: ".env", body: "" }
}

/**
 * Repo-qualified project name. A root-level `.env` keeps the plain repo name
 * (`env-share`); a nested folder is prefixed with the repo (`lighthouse/frontend`).
 */
function candidateDisplayName(
  rootName: string,
  candidate: FolderScanCandidate,
): string {
  if (!candidate.relativePath || candidate.relativePath === ".") return rootName
  return `${rootName}/${candidate.folderName}`
}

export function NewProjectDialog({
  open,
  onOpenChange,
  initialTab = "folder",
  preferShareCode,
}: NewProjectDialogProps) {
  const api = useApi()
  const navigate = useNavigate()
  const createProject = useProjectsStore((s) => s.createProject)
  const syncProject = useProjectsStore((s) => s.syncProject)
  const getDecryptedProject = useProjectsStore((s) => s.getDecryptedProject)
  const projects = useProjectsStore((s) => s.projects)
  const fetchProjects = useProjectsStore((s) => s.fetchProjects)

  const [tab, setTab] = useState<"folder" | "manual">(initialTab)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<
    "idle" | "scanning" | "resolving" | "review" | "diff" | "submitting"
  >("idle")
  const [scanProgress, setScanProgress] = useState<{
    foundFiles: number
    scannedFolders: number
  } | null>(null)
  const [candidates, setCandidates] = useState<ResolvedCandidate[]>([])
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [manualName, setManualName] = useState("")
  const [drafts, setDrafts] = useState<ManualDraft[]>([makeDraft()])

  function reset() {
    setTab(initialTab)
    setPhase("idle")
    setScanProgress(null)
    setCandidates([])
    setActiveCandidateId(null)
    setWarnings([])
    setManualName("")
    setDrafts([makeDraft()])
    setBusy(false)
  }

  function onDialogChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initialTab)
  }, [open, initialTab])

  async function classifyCandidate(
    candidate: FolderScanCandidate,
    rootName: string,
  ): Promise<ResolvedCandidate> {
    const fingerprint = await computeFolderFingerprint(
      rootName,
      candidate.relativePath,
      candidate.environments.map((env) => env.filename),
    )
    const match = projects.find(
      (project) => project.folderFingerprint === fingerprint,
    )
    const base = {
      id: candidate.id,
      folderName: candidate.folderName,
      displayName: candidateDisplayName(rootName, candidate),
      relativePath: candidate.relativePath,
      fingerprint,
      environments: candidate.environments,
    }

    if (!match) {
      return { ...base, status: { kind: "new" } }
    }

    try {
      const decrypted = await getDecryptedProject(api, match.shareCode)
      const diff = diffEnvironments(decrypted.environments, candidate.environments)
      if (isProjectDiffEmpty(diff)) {
        return { ...base, status: { kind: "up-to-date", existing: match } }
      }
      return { ...base, status: { kind: "changed", existing: match, diff } }
    } catch (err) {
      if (err instanceof MissingKeyError) {
        return { ...base, status: { kind: "match-no-key", existing: match } }
      }
      throw err
    }
  }

  async function handleSelectFolder() {
    if (!isFolderPickerSupported()) {
      toast.error("Folder picker is not supported in this browser")
      return
    }

    setBusy(true)
    setPhase("scanning")
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

      if (result.candidates.length === 0) {
        toast.warning("No .env files found in selected folder")
        reset()
        return
      }

      setPhase("resolving")
      setWarnings(result.warnings)
      const resolved = await Promise.all(
        result.candidates.map((candidate) =>
          classifyCandidate(candidate, result.rootName),
        ),
      )

      // If user invoked from a specific project, sort that one first.
      if (preferShareCode) {
        resolved.sort((a, b) => {
          const aMatch =
            "existing" in a.status &&
            a.status.existing.shareCode === preferShareCode
              ? -1
              : 0
          const bMatch =
            "existing" in b.status &&
            b.status.existing.shareCode === preferShareCode
              ? -1
              : 0
          return aMatch - bMatch
        })
      }

      setCandidates(resolved)
      setActiveCandidateId(resolved[0]?.id ?? null)
      setPhase("review")
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError"
      if (isAbort) {
        reset()
        return
      }
      if (err instanceof ScanLimitError) {
        toast.error(err.message)
      } else {
        toast.error(
          err instanceof Error ? err.message : "Could not scan folder",
        )
      }
      reset()
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
      const project = await createProject(api, {
        name,
        environments,
        source: "manual",
      })
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

  async function handleImportNew(candidate: ResolvedCandidate) {
    setBusy(true)
    try {
      const project = await createProject(api, {
        name: candidate.displayName,
        environments: candidate.environments.map((env) => ({
          ...env,
          id: generateUuid(),
        })),
        source: "folder",
        folderFingerprint: candidate.fingerprint,
        folderName: candidate.displayName,
      })
      setCandidates((prev) =>
        prev.map((row) =>
          row.id === candidate.id
            ? {
                ...row,
                resolved: "imported",
                resolvedShareCode: project.shareCode,
              }
            : row,
        ),
      )
      toast.success(`Imported "${project.name}"`)
    } catch (err) {
      toast.error("Failed to import", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSyncChanges(candidate: ResolvedCandidate) {
    if (candidate.status.kind !== "changed") return
    setBusy(true)
    try {
      const total = countDiffChanges(candidate.status.diff)
      await syncProject(api, candidate.status.existing.shareCode, {
        environments: candidate.environments,
      })
      setCandidates((prev) =>
        prev.map((row) =>
          row.id === candidate.id
            ? {
                ...row,
                resolved: "synced",
                resolvedShareCode:
                  row.status.kind !== "new" ? row.status.existing.shareCode : undefined,
              }
            : row,
        ),
      )
      toast.success(
        total === 1 ? "Synced — 1 change applied" : `Synced — ${total} changes applied`,
      )
      setPhase("review")
    } catch (err) {
      toast.error("Failed to sync", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  const newCount = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.status.kind === "new" && !candidate.resolved,
      ).length,
    [candidates],
  )
  const changedCount = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          candidate.status.kind === "changed" && !candidate.resolved,
      ).length,
    [candidates],
  )
  const upToDateCount = useMemo(
    () =>
      candidates.filter((candidate) => candidate.status.kind === "up-to-date")
        .length,
    [candidates],
  )

  async function handleImportAllNew() {
    const queue = candidates.filter(
      (candidate) => candidate.status.kind === "new" && !candidate.resolved,
    )
    if (queue.length === 0) return
    setBusy(true)
    try {
      let created = 0
      let firstShareCode: string | null = null
      for (const candidate of queue) {
        const project = await createProject(api, {
          name: candidate.displayName,
          environments: candidate.environments.map((env) => ({
            ...env,
            id: generateUuid(),
          })),
          source: "folder",
          folderFingerprint: candidate.fingerprint,
          folderName: candidate.displayName,
        })
        if (!firstShareCode) firstShareCode = project.shareCode
        setCandidates((prev) =>
          prev.map((row) =>
            row.id === candidate.id
              ? {
                  ...row,
                  resolved: "imported",
                  resolvedShareCode: project.shareCode,
                }
              : row,
          ),
        )
        created++
      }
      toast.success(
        created === 1 ? "Imported 1 project" : `Imported ${created} projects`,
      )
      // refresh metadata sweep
      await fetchProjects(api)
      // if the only candidate was a single new one, jump there.
      if (candidates.length === 1 && firstShareCode) {
        onDialogChange(false)
        navigate(`/project/${firstShareCode}`)
      }
    } catch (err) {
      toast.error("Some imports failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  const activeCandidate = candidates.find((row) => row.id === activeCandidateId)

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {phase === "diff"
              ? "Sync changes"
              : phase === "scanning" || phase === "resolving"
                ? "Scanning folder"
                : "New project"}
          </DialogTitle>
          <DialogDescription>
            {phase === "diff" && activeCandidate
              ? `Already imported as "${"existing" in activeCandidate.status ? activeCandidate.status.existing.name : ""}". Review and sync changes.`
              : "Import .env files from a folder, or paste variables manually."}
          </DialogDescription>
        </DialogHeader>

        {phase === "diff" && activeCandidate ? (
          <FolderDiffStep
            candidate={activeCandidate}
            busy={busy}
            onCancel={() => setPhase("review")}
            onSync={() => handleSyncChanges(activeCandidate)}
          />
        ) : (
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
                <motion.div
                  key="folder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <TabsContent value="folder" forceMount className="space-y-4">
                    {phase === "idle" || phase === "scanning" || phase === "resolving" ? (
                      <FolderIdleStep
                        busy={busy}
                        phase={phase}
                        progress={scanProgress}
                        onPick={handleSelectFolder}
                      />
                    ) : (
                      <FolderReviewStep
                        candidates={candidates}
                        warnings={warnings}
                        busy={busy}
                        newCount={newCount}
                        changedCount={changedCount}
                        upToDateCount={upToDateCount}
                        onImportAll={handleImportAllNew}
                        onImportOne={handleImportNew}
                        onReviewDiff={(id) => {
                          setActiveCandidateId(id)
                          setPhase("diff")
                        }}
                        onOpen={(shareCode) => {
                          onDialogChange(false)
                          navigate(`/project/${shareCode}`)
                        }}
                        onPickAgain={reset}
                        onDone={() => onDialogChange(false)}
                      />
                    )}
                  </TabsContent>
                </motion.div>
              ) : (
                <motion.div
                  key="manual"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <TabsContent value="manual" forceMount>
                    <ManualForm
                      busy={busy}
                      manualName={manualName}
                      drafts={drafts}
                      onNameChange={setManualName}
                      onDraftsChange={setDrafts}
                      onSubmit={handleManualCreate}
                    />
                  </TabsContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FolderIdleStep({
  busy,
  phase,
  progress,
  onPick,
}: {
  busy: boolean
  phase: "idle" | "scanning" | "resolving"
  progress: { foundFiles: number; scannedFolders: number } | null
  onPick: () => void
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <FolderOpen className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-6 text-[18px] font-semibold tracking-tight text-foreground">
        Import from a folder
      </h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        Scan a folder for .env files. Already-imported folders are detected and
        synced instead of duplicated.
      </p>
      {phase === "scanning" && progress ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Scanning… found {progress.foundFiles} files in {progress.scannedFolders}{" "}
          folders
        </p>
      ) : null}
      {phase === "resolving" ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Comparing against existing projects…
        </p>
      ) : null}
      <Button className="mt-8" onClick={onPick} loading={busy}>
        {busy ? "Scanning…" : "Select folder"}
      </Button>
    </div>
  )
}

function FolderReviewStep({
  candidates,
  warnings,
  busy,
  newCount,
  changedCount,
  upToDateCount,
  onImportAll,
  onImportOne,
  onReviewDiff,
  onOpen,
  onPickAgain,
  onDone,
}: {
  candidates: ResolvedCandidate[]
  warnings: string[]
  busy: boolean
  newCount: number
  changedCount: number
  upToDateCount: number
  onImportAll: () => void
  onImportOne: (candidate: ResolvedCandidate) => void
  onReviewDiff: (id: string) => void
  onOpen: (shareCode: string) => void
  onPickAgain: () => void
  onDone: () => void
}) {
  const allResolved = candidates.every((c) => c.resolved !== undefined)

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
        Found {candidates.length} folder{candidates.length === 1 ? "" : "s"} with envs
        {newCount > 0 ? ` · ${newCount} new` : ""}
        {changedCount > 0 ? ` · ${changedCount} with changes` : ""}
        {upToDateCount > 0 ? ` · ${upToDateCount} up to date` : ""}
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
        {candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            busy={busy}
            onImport={() => onImportOne(candidate)}
            onReview={() => onReviewDiff(candidate.id)}
            onOpen={(shareCode) => onOpen(shareCode)}
          />
        ))}
      </div>

      {warnings.length > 0 ? (
        <details className="rounded-md bg-amber-500/5 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          <summary className="cursor-pointer select-none">
            {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 pl-2 text-[11.5px]">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onPickAgain} disabled={busy}>
          <ArrowLeft className="size-3.5" />
          Pick again
        </Button>
        {allResolved ? (
          <Button onClick={onDone} disabled={busy}>
            Done
          </Button>
        ) : newCount > 0 ? (
          <Button onClick={onImportAll} loading={busy}>
            {busy
              ? "Importing…"
              : newCount === 1
                ? "Import"
                : `Import ${newCount} new`}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function CandidateRow({
  candidate,
  busy,
  onImport,
  onReview,
  onOpen,
}: {
  candidate: ResolvedCandidate
  busy: boolean
  onImport: () => void
  onReview: () => void
  onOpen: (shareCode: string) => void
}) {
  const status = candidate.status

  if (candidate.resolved === "imported") {
    return (
      <RowShell candidate={candidate} tone="ok" pillLabel="Imported">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            candidate.resolvedShareCode &&
            onOpen(candidate.resolvedShareCode)
          }
        >
          Open
        </Button>
      </RowShell>
    )
  }
  if (candidate.resolved === "synced") {
    return (
      <RowShell candidate={candidate} tone="ok" pillLabel="Synced">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            status.kind !== "new" && onOpen(status.existing.shareCode)
          }
        >
          Open
        </Button>
      </RowShell>
    )
  }

  if (status.kind === "new") {
    return (
      <RowShell candidate={candidate} tone="new" pillLabel="New">
        <Button size="sm" onClick={onImport} loading={busy}>
          Import
        </Button>
      </RowShell>
    )
  }
  if (status.kind === "up-to-date") {
    return (
      <RowShell candidate={candidate} tone="ok" pillLabel="Up to date">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpen(status.existing.shareCode)}
        >
          Open
        </Button>
      </RowShell>
    )
  }
  if (status.kind === "changed") {
    return (
      <RowShell
        candidate={candidate}
        tone="changed"
        pillLabel={`${countDiffChanges(status.diff)} change${countDiffChanges(status.diff) === 1 ? "" : "s"}`}
      >
        <Button size="sm" onClick={onReview} disabled={busy}>
          <RefreshCcw className="size-3.5" />
          Review
        </Button>
      </RowShell>
    )
  }
  // match-no-key
  return (
    <RowShell candidate={candidate} tone="warn" pillLabel="Key missing">
      <p className="max-w-[180px] text-[11px] text-muted-foreground">
        Already imported on another device. Open from there to sync.
      </p>
    </RowShell>
  )
}

function RowShell({
  candidate,
  tone,
  pillLabel,
  children,
}: {
  candidate: ResolvedCandidate
  tone: "new" | "ok" | "changed" | "warn"
  pillLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-md p-2 transition-colors duration-150 hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{candidate.displayName}</p>
        <p className="text-[11.5px] text-muted-foreground">
          {candidate.environments.length} env file
          {candidate.environments.length === 1 ? "" : "s"}
          {candidate.relativePath && candidate.relativePath !== "."
            ? ` · ${candidate.relativePath}`
            : ""}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
          tone === "new" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          tone === "ok" && "bg-muted text-muted-foreground",
          tone === "changed" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
          tone === "warn" && "bg-rose-500/10 text-rose-700 dark:text-rose-400",
        )}
      >
        {tone === "ok" && candidate.resolved ? (
          <CheckCircle2 className="size-3" />
        ) : null}
        {pillLabel}
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function FolderDiffStep({
  candidate,
  busy,
  onCancel,
  onSync,
}: {
  candidate: ResolvedCandidate
  busy: boolean
  onCancel: () => void
  onSync: () => void
}) {
  if (candidate.status.kind !== "changed") return null
  const diff = candidate.status.diff
  const total = countDiffChanges(diff)
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-[12.5px]">
        <p className="font-medium text-foreground">
          {candidate.status.existing.name}
        </p>
        <p className="text-muted-foreground">
          Folder fingerprint matches. {total} change{total === 1 ? "" : "s"} pending.
        </p>
      </div>
      <DiffView diff={diff} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onSync} loading={busy}>
          {busy ? "Syncing…" : "Sync changes"}
        </Button>
      </div>
    </div>
  )
}

function ManualForm({
  busy,
  manualName,
  drafts,
  onNameChange,
  onDraftsChange,
  onSubmit,
}: {
  busy: boolean
  manualName: string
  drafts: ManualDraft[]
  onNameChange: (next: string) => void
  onDraftsChange: (
    updater: ManualDraft[] | ((prev: ManualDraft[]) => ManualDraft[]),
  ) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="manual-project-name">Project name</Label>
        <Input
          id="manual-project-name"
          value={manualName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="my-app"
        />
      </div>
      <div className="space-y-3">
        {drafts.map((draft, index) => (
          <div
            key={draft.id}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2">
              <Input
                value={draft.filename}
                onChange={(event) =>
                  onDraftsChange((prev: ManualDraft[]) =>
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
                  onDraftsChange((prev: ManualDraft[]) =>
                    prev.filter((item) => item.id !== draft.id),
                  )
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
                onDraftsChange((prev: ManualDraft[]) =>
                  prev.map((item) =>
                    item.id === draft.id
                      ? { ...item, body: event.target.value }
                      : item,
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
        onClick={() =>
          onDraftsChange((prev: ManualDraft[]) => [...prev, makeDraft()])
        }
      >
        <Plus className="size-3.5" />
        Add another environment
      </Button>
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          {busy ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  )
}
