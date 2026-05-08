import { motion } from "framer-motion"
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react"
import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { EnvTable } from "@/components/projects/env-table"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  copyToClipboard,
  downloadEnvFile,
  serializeEnv,
} from "@/lib/env-export"
import {
  isFolderPickerSupported,
  pickDirectoryHandle,
  scanDirectoryForEnvFiles,
} from "@/lib/folder-import"
import { generateUuid } from "@/lib/local"
import type { ProjectEnvironment } from "@/lib/types"
import { useProjectsStore } from "@/store/projects-store"

export function ProjectViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const project = useProjectsStore((s) =>
    id ? s.projects.find((p) => p.id === id) : undefined,
  )
  const hydrated = useProjectsStore((s) => s.hydrated)
  const rescanProject = useProjectsStore((s) => s.rescanProject)

  const [activeFile, setActiveFile] = useState<string | undefined>(undefined)
  const [revealAll, setRevealAll] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const [rescanning, setRescanning] = useState(false)

  const envIds = project?.environments.map((e) => e.id) ?? []
  const resolvedActive =
    activeFile && envIds.includes(activeFile) ? activeFile : envIds[0]

  if (!hydrated) {
    return (
      <div className="text-[13px] text-muted-foreground">Loading…</div>
    )
  }

  if (!project) {
    return (
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-heading text-xl font-medium text-foreground">
          Project not found
        </h1>
        <p className="text-[13px] text-muted-foreground">
          This project doesn’t exist on this device.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-3.5" />
            Back to dashboard
          </Link>
        </Button>
      </motion.div>
    )
  }

  const isFolderProject = project.source.kind === "folder"

  async function handleCopyShareCode() {
    if (!project) return
    try {
      await copyToClipboard(project.shareCode)
      setCopiedShare(true)
      toast.success("Share code copied")
      setTimeout(() => setCopiedShare(false), 1500)
    } catch {
      toast.error("Could not copy share code")
    }
  }

  async function handleRescan() {
    if (!project) return
    if (!isFolderPickerSupported()) {
      toast.error("Folder picker not supported in this browser")
      return
    }
    setRescanning(true)
    try {
      const handle = await pickDirectoryHandle()
      const result = await scanDirectoryForEnvFiles(handle)
      // Prefer a candidate matching the original folderName at root, else the root itself.
      const folderName =
        project.source.kind === "folder"
          ? project.source.folderName
          : project.name
      const target =
        result.candidates.find((c) => c.relativePath === ".") ??
        result.candidates.find((c) => c.folderName === folderName) ??
        result.candidates[0]

      if (!target) {
        toast.warning("No .env files found in the selected folder")
        return
      }

      const environments: ProjectEnvironment[] = target.environments.map(
        (env) => ({
          id: generateUuid(),
          filename: env.filename,
          variables: env.variables,
        }),
      )
      rescanProject(project.id, environments)
      setActiveFile(environments[0]?.id)
      toast.success("Re-scan complete", {
        description: `Reloaded ${environments.length} file${
          environments.length === 1 ? "" : "s"
        }`,
      })
      if (result.warnings.length > 0) {
        toast.warning(`${result.warnings.length} folder(s) skipped`)
      }
    } catch (err) {
      const isAbort =
        err instanceof DOMException && err.name === "AbortError"
      if (!isAbort) {
        toast.error("Re-scan failed", {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    } finally {
      setRescanning(false)
    }
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header
        name={project.name}
        shareCode={project.shareCode}
        copied={copiedShare}
        onCopyShare={handleCopyShareCode}
        onRescan={isFolderProject ? handleRescan : undefined}
        rescanning={rescanning}
        onBack={() => navigate("/")}
      />

      {project.environments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-6 py-12 text-center text-[13px] text-muted-foreground">
          This project has no environments yet.
        </div>
      ) : (
        <Tabs
          value={resolvedActive}
          onValueChange={setActiveFile}
          className="gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="flex-wrap">
              {project.environments.map((env) => (
                <TabsTrigger
                  key={env.id}
                  value={env.id}
                  className="font-mono text-[12.5px]"
                >
                  {env.filename}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevealAll((r) => !r)}
              aria-pressed={revealAll}
            >
              {revealAll ? (
                <>
                  <EyeOff className="size-3.5" />
                  Hide all
                </>
              ) : (
                <>
                  <Eye className="size-3.5" />
                  Show all
                </>
              )}
            </Button>
          </div>

          {project.environments.map((env) => (
            <TabsContent
              key={env.id}
              value={env.id}
              className="space-y-3"
            >
              <EnvActions environment={env} />
              <EnvTable variables={env.variables} revealAll={revealAll} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </motion.div>
  )
}

function Header({
  name,
  shareCode,
  copied,
  onCopyShare,
  onRescan,
  rescanning,
  onBack,
}: {
  name: string
  shareCode: string
  copied: boolean
  onCopyShare: () => void
  onRescan?: () => void
  rescanning: boolean
  onBack: () => void
}) {
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        Dashboard
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Project
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/50 px-2.5 py-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Code
            </span>
            <code className="font-mono text-[12.5px] text-foreground">
              {shareCode}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onCopyShare}
              aria-label="Copy share code"
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
          </div>
          {onRescan && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRescan}
              disabled={rescanning}
            >
              <RefreshCw
                className={`size-3.5 ${rescanning ? "animate-spin" : ""}`}
              />
              {rescanning ? "Scanning…" : "Re-scan folder"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function EnvActions({ environment }: { environment: ProjectEnvironment }) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(
    () => serializeEnv(environment.variables),
    [environment.variables],
  )

  async function handleCopy() {
    try {
      await copyToClipboard(text)
      setCopied(true)
      toast.success(`Copied ${environment.filename}`, {
        description: `${environment.variables.length} variables`,
      })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy variables")
    }
  }

  function handleDownload() {
    if (environment.variables.length === 0) {
      toast.warning("Nothing to download")
      return
    }
    downloadEnvFile(environment.filename, text + "\n")
    toast.success(`Downloaded ${environment.filename}`)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-[12px] text-muted-foreground">
        {environment.variables.length}{" "}
        {environment.variables.length === 1 ? "variable" : "variables"}
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          Copy all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="size-3.5" />
          Download
        </Button>
      </div>
    </div>
  )
}
