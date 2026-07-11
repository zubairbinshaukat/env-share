import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog"
import { EnvEditDialog } from "@/components/projects/env-edit-dialog"
import { EnvTable } from "@/components/projects/env-table"
import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { ProjectMenuContent } from "@/components/projects/project-menu"
import { RegenerateDialog } from "@/components/projects/regenerate-dialog"
import { SourceBadge } from "@/components/projects/source-badge"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/lib/api"
import { bodyToEnvVariables, envToBody } from "@/lib/env-edit"
import { copyToClipboard, downloadEnvFile, serializeEnv } from "@/lib/env-export"
import { computeFolderFingerprint } from "@/lib/folder-import"
import { generateUuid } from "@/lib/local"
import { buildShareUrl } from "@/lib/share-link"
import type { ProjectEnvironment, ProjectSource } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  MissingKeyError,
  readProjectKey,
  useProjectsStore,
} from "@/store/projects-store"

interface DecryptedView {
  shareCode: string
  name: string
  environments: ProjectEnvironment[]
  source: ProjectSource
  folderFingerprint?: string
  folderName?: string
  createdAt: number
  updatedAt: number
}

export function ProjectViewPage() {
  const api = useApi()
  const navigate = useNavigate()
  const { shareCode } = useParams<{ shareCode: string }>()
  const getDecryptedProject = useProjectsStore((s) => s.getDecryptedProject)
  const patchProject = useProjectsStore((s) => s.patchProject)
  const syncProject = useProjectsStore((s) => s.syncProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const duplicateProject = useProjectsStore((s) => s.duplicateProject)
  const regenerateShareCode = useProjectsStore((s) => s.regenerateShareCode)

  const [project, setProject] = useState<DecryptedView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined)
  const [revealAll, setRevealAll] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [busy, setBusy] = useState(false)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")

  const [editEnvOpen, setEditEnvOpen] = useState(false)
  const [editEnvId, setEditEnvId] = useState<string | null>(null)

  const [addEnvOpen, setAddEnvOpen] = useState(false)

  const [deleteEnvId, setDeleteEnvId] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [rescanOpen, setRescanOpen] = useState(false)

  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!shareCode) return
    let cancelled = false
    Promise.resolve()
      .then(() => {
        if (cancelled) return
        setLoading(true)
        setError(null)
        return getDecryptedProject(api, shareCode)
      })
      .then((data) => {
        if (!cancelled && data) setProject(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof MissingKeyError) {
          setError("This device doesn't have the encryption key for this project.")
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load project")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [api, getDecryptedProject, shareCode])

  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (renameOpen) {
      window.requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    }
  }, [renameOpen])

  const envIds = project?.environments.map((env) => env.id) ?? []
  const resolvedActive = activeFile && envIds.includes(activeFile) ? activeFile : envIds[0]
  const isFolderProject = (project?.source ?? "manual") === "folder"

  function reloadProject() {
    if (!shareCode) return
    getDecryptedProject(api, shareCode)
      .then((data) => setProject(data))
      .catch((err) => {
        toast.error("Failed to refresh project", {
          description: err instanceof Error ? err.message : "Unexpected error",
        })
      })
  }

  async function handleCopyShareLink() {
    if (!project) return
    const key = readProjectKey(project.shareCode)
    if (!key) {
      toast.error("Encryption key not found in localStorage")
      return
    }
    await copyToClipboard(buildShareUrl(project.shareCode, key))
    setCopiedShare(true)
    window.setTimeout(() => setCopiedShare(false), 2000)
    toast.success("Share link copied")
  }

  function startRename() {
    if (!project) return
    setRenameValue(project.name)
    setRenameOpen(true)
  }

  async function commitRename() {
    if (!project) return
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
    const previousName = project.name
    setProject({ ...project, name: trimmed })
    setRenameOpen(false)
    setBusy(true)
    try {
      await patchProject(api, project.shareCode, { name: trimmed })
      toast.success(`Renamed to "${trimmed}"`)
    } catch (err) {
      setProject({ ...project, name: previousName })
      toast.error("Failed to rename", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleAddEnv(filename: string, body: string) {
    if (!project) return
    setBusy(true)
    try {
      const newEnv: ProjectEnvironment = {
        id: generateUuid(),
        filename,
        variables: bodyToEnvVariables(body),
      }
      const nextEnvs = [...project.environments, newEnv]
      await syncProject(api, project.shareCode, { environments: nextEnvs })
      setProject({ ...project, environments: nextEnvs })
      setAddEnvOpen(false)
      setActiveFile(newEnv.id)
      toast.success(`Added ${filename}`)
    } catch (err) {
      toast.error("Failed to add environment", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleEditEnv(filename: string, body: string) {
    if (!project || !editEnvId) return
    setBusy(true)
    try {
      const nextEnvs = project.environments.map((env) =>
        env.id === editEnvId
          ? { ...env, filename, variables: bodyToEnvVariables(body) }
          : env,
      )
      await syncProject(api, project.shareCode, { environments: nextEnvs })
      setProject({ ...project, environments: nextEnvs })
      setEditEnvOpen(false)
      setEditEnvId(null)
      toast.success(`Environment updated`)
    } catch (err) {
      toast.error("Failed to update environment", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteEnv() {
    if (!project || !deleteEnvId) return
    const target = project.environments.find((env) => env.id === deleteEnvId)
    if (!target) return
    setBusy(true)
    try {
      const nextEnvs = project.environments.filter(
        (env) => env.id !== deleteEnvId,
      )
      await syncProject(api, project.shareCode, { environments: nextEnvs })
      setProject({ ...project, environments: nextEnvs })
      if (activeFile === deleteEnvId) setActiveFile(nextEnvs[0]?.id)
      setDeleteEnvId(null)
      toast.success(`Deleted ${target.filename}`)
    } catch (err) {
      toast.error("Failed to delete environment", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteProject() {
    if (!project) return
    setBusy(true)
    try {
      await deleteProject(api, project.shareCode)
      toast.success("Project deleted")
      navigate("/")
    } catch (err) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
      setBusy(false)
    }
  }

  async function handleDuplicate() {
    if (!project) return
    setBusy(true)
    try {
      const created = await duplicateProject(api, project.shareCode)
      toast.success(`Duplicated as "${created.name}"`)
      navigate(`/project/${created.shareCode}`)
    } catch (err) {
      toast.error("Failed to duplicate", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    if (!project) return
    setBusy(true)
    try {
      const updated = await regenerateShareCode(api, project.shareCode)
      setRegenerateOpen(false)
      // navigate to the new share code
      navigate(`/project/${updated.shareCode}`, { replace: true })
      const newKey = readProjectKey(updated.shareCode)
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

  async function ensureFolderFingerprintMatches() {
    if (!project) return
    if (project.source !== "folder") return
    if (project.folderFingerprint) return
    // Best-effort backfill for legacy folder projects with no stored
    // fingerprint. We no longer know the original scan root/relative path, so
    // treat the stored folder name as a root-level import; a fresh re-scan of a
    // nested folder may still register as new, which the review UI handles.
    const fingerprint = await computeFolderFingerprint(
      project.folderName ?? project.name,
      ".",
      project.environments.map((env) => env.filename),
    )
    try {
      await patchProject(api, project.shareCode, {
        folderFingerprint: fingerprint,
      })
    } catch {
      // best-effort
    }
  }

  if (loading && !timedOut) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/70" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-muted/50" />
      </div>
    )
  }
  if (error || timedOut) {
    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Unable to load project
        </h1>
        <p className="max-w-md text-[14px] leading-relaxed text-muted-foreground">
          {timedOut ? "Couldn't load — retry" : error}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTimedOut(false)
            reloadProject()
          }}
        >
          Retry
        </Button>
      </motion.div>
    )
  }
  if (!project) {
    return <p className="text-[14px] text-muted-foreground">Project not found.</p>
  }

  return (
    <motion.div
      className="space-y-10 sm:space-y-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Helmet>
        <title>{project.name} - EnvShare</title>
      </Helmet>

      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 px-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Button>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={cn(
                  "group relative inline-flex items-center gap-2 rounded-md text-left text-[32px] font-semibold tracking-tight text-foreground outline-none",
                  "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/30",
                )}
                onClick={startRename}
                title="Click to rename"
              >
                <span className="truncate">{project.name}</span>
                <Pencil className="size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </button>
              <SourceBadge project={project} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-full bg-muted px-3 py-1 font-mono text-[13px] text-muted-foreground">
              {project.shareCode}
            </code>
            <Button size="default" onClick={handleCopyShareLink}>
              {copiedShare ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4" />
              )}
              {copiedShare ? "Copied!" : "Copy share link"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="More project actions"
                  disabled={busy}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <ProjectMenuContent
                project={project}
                context="header"
                busy={busy}
                onCopyShareLink={handleCopyShareLink}
                onRename={startRename}
                onEditEnvs={
                  isFolderProject
                    ? undefined
                    : () => {
                        setEditEnvId(project.environments[0]?.id ?? null)
                        setEditEnvOpen(true)
                      }
                }
                onRescanFolder={
                  isFolderProject
                    ? () => {
                        ensureFolderFingerprintMatches()
                        setRescanOpen(true)
                      }
                    : undefined
                }
                onDuplicate={handleDuplicate}
                onRegenerate={() => setRegenerateOpen(true)}
                onDelete={() => setDeleteOpen(true)}
              />
            </DropdownMenu>
          </div>
        </div>
      </div>

      {project.environments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-[14px] text-muted-foreground">
            This project has no environments.
          </p>
          {!isFolderProject ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAddEnvOpen(true)}
            >
              <Plus className="size-3.5" />
              Add environment
            </Button>
          ) : null}
        </div>
      ) : (
        <Tabs value={resolvedActive} onValueChange={setActiveFile}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <TabsList className="h-auto flex-wrap rounded-none bg-transparent p-0">
              {project.environments.map((env) => (
                <div key={env.id} className="group relative">
                  <TabsTrigger
                    value={env.id}
                    className="rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-2 pr-7 font-mono text-[12px] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    {env.filename}
                  </TabsTrigger>
                  {!isFolderProject && project.environments.length > 1 ? (
                    <button
                      type="button"
                      className="absolute right-0 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-muted hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${env.filename}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteEnvId(env.id)
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </TabsList>
            {!isFolderProject ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddEnvOpen(true)}
              >
                <Plus className="size-3.5" />
                Add environment
              </Button>
            ) : null}
          </div>
          {project.environments.map((env) => (
            <TabsContent key={env.id} value={env.id} className="space-y-4">
              <EnvActions
                environment={env}
                editable={!isFolderProject}
                onEdit={() => {
                  setEditEnvId(env.id)
                  setEditEnvOpen(true)
                }}
              />
              <EnvTable
                variables={env.variables}
                revealAll={revealAll}
                onRevealAllChange={setRevealAll}
                envName={env.filename}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Rename dialog */}
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
            ref={renameInputRef}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename()
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
            <Button type="button" disabled={busy} onClick={commitRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add environment dialog (manual only) */}
      {!isFolderProject ? (
        <EnvEditDialog
          open={addEnvOpen}
          onOpenChange={setAddEnvOpen}
          mode="add"
          existingFilenames={project.environments.map((env) => env.filename)}
          onSubmit={handleAddEnv}
          busy={busy}
        />
      ) : null}

      {/* Edit environment dialog (manual only) */}
      {!isFolderProject && editEnvOpen && editEnvId ? (
        <EnvEditDialog
          open={editEnvOpen}
          onOpenChange={(next) => {
            setEditEnvOpen(next)
            if (!next) setEditEnvId(null)
          }}
          mode="edit"
          initial={(() => {
            const env = project.environments.find((e) => e.id === editEnvId)
            return env
              ? { filename: env.filename, body: envToBody(env) }
              : { filename: ".env", body: "" }
          })()}
          existingFilenames={project.environments.map((env) => env.filename)}
          onSubmit={handleEditEnv}
          busy={busy}
        />
      ) : null}

      {/* Delete environment confirm */}
      <Dialog
        open={Boolean(deleteEnvId)}
        onOpenChange={(next) => {
          if (busy) return
          if (!next) setDeleteEnvId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete{" "}
              {(() => {
                const env = project.environments.find((e) => e.id === deleteEnvId)
                return env ? env.filename : "environment"
              })()}{" "}
              from this project?
            </DialogTitle>
            <DialogDescription>
              This removes the file and its variables. The project itself stays.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleteEnvId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={handleDeleteEnv}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete project confirm */}
      <DeleteProjectDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectName={project.name}
        onConfirm={handleDeleteProject}
        busy={busy}
      />

      {/* Regenerate share link */}
      <RegenerateDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onConfirm={handleRegenerate}
        busy={busy}
      />

      {/* Re-scan folder dialog */}
      <NewProjectDialog
        open={rescanOpen}
        onOpenChange={(next) => {
          setRescanOpen(next)
          if (!next) reloadProject()
        }}
        initialTab="folder"
        preferShareCode={project.shareCode}
      />
    </motion.div>
  )
}

function EnvActions({
  environment,
  editable,
  onEdit,
}: {
  environment: ProjectEnvironment
  editable: boolean
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => serializeEnv(environment.variables), [environment.variables])

  async function handleCopy() {
    await copyToClipboard(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    toast.success(`Copied ${environment.filename}`)
  }

  function handleDownload() {
    downloadEnvFile(environment.filename, `${text}\n`)
    toast.success(`Downloaded ${environment.filename}`)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-[13px] text-muted-foreground">
        {environment.variables.length} variable
        {environment.variables.length === 1 ? "" : "s"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy all"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <Download className="size-4" />
          Download
        </Button>
      </div>
    </div>
  )
}
