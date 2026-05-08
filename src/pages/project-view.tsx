import { ArrowLeft, Check, Copy, Download, Eye, EyeOff } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { EnvTable } from "@/components/projects/env-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/lib/api"
import { copyToClipboard, downloadEnvFile, serializeEnv } from "@/lib/env-export"
import { buildShareUrl } from "@/lib/share-link"
import type { ProjectEnvironment } from "@/lib/types"
import { MissingKeyError, useProjectsStore } from "@/store/projects-store"

export function ProjectViewPage() {
  const api = useApi()
  const navigate = useNavigate()
  const { shareCode } = useParams<{ shareCode: string }>()
  const getDecryptedProject = useProjectsStore((s) => s.getDecryptedProject)

  const [project, setProject] = useState<{
    shareCode: string
    name: string
    environments: ProjectEnvironment[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined)
  const [revealAll, setRevealAll] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    if (!shareCode) return
    getDecryptedProject(api, shareCode)
      .then((data) => setProject(data))
      .catch((err) => {
        if (err instanceof MissingKeyError) {
          setError("This device doesn't have the encryption key for this project.")
          return
        }
        setError(err instanceof Error ? err.message : "Failed to load project")
      })
      .finally(() => setLoading(false))
  }, [api, getDecryptedProject, shareCode])

  const envIds = project?.environments.map((env) => env.id) ?? []
  const resolvedActive = activeFile && envIds.includes(activeFile) ? activeFile : envIds[0]

  async function handleCopyShareLink() {
    if (!project) return
    const key = window.localStorage.getItem(`project_key_${project.shareCode}`)
    if (!key) {
      toast.error("Encryption key not found in localStorage")
      return
    }
    await copyToClipboard(buildShareUrl(project.shareCode, key))
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 1300)
    toast.success("Share link copied")
  }

  if (loading) {
    return <div className="text-[13px] text-muted-foreground">Loading project...</div>
  }
  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Unable to load project</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    )
  }
  if (!project) {
    return <div className="text-[13px] text-muted-foreground">Project not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</p>
            <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded border border-border/70 px-2 py-1 font-mono text-xs text-foreground">
              {project.shareCode}
            </code>
            <Button size="sm" onClick={handleCopyShareLink}>
              {copiedShare ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy share link
            </Button>
          </div>
        </div>
      </div>
      {project.environments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          This project has no environments.
        </div>
      ) : (
        <Tabs value={resolvedActive} onValueChange={setActiveFile}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList className="flex-wrap">
              {project.environments.map((env) => (
                <TabsTrigger key={env.id} value={env.id} className="font-mono text-xs">
                  {env.filename}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button variant="ghost" size="sm" onClick={() => setRevealAll((value) => !value)}>
              {revealAll ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {revealAll ? "Hide all" : "Show all"}
            </Button>
          </div>
          {project.environments.map((env) => (
            <TabsContent key={env.id} value={env.id} className="space-y-3">
              <EnvActions environment={env} />
              <EnvTable variables={env.variables} revealAll={revealAll} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

function EnvActions({ environment }: { environment: ProjectEnvironment }) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => serializeEnv(environment.variables), [environment.variables])

  async function handleCopy() {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1300)
    toast.success(`Copied ${environment.filename}`)
  }

  function handleDownload() {
    downloadEnvFile(environment.filename, `${text}\n`)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="text-[12px] text-muted-foreground">
        {environment.variables.length} variable
        {environment.variables.length === 1 ? "" : "s"}
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <Download className="size-3.5" />
          Download
        </Button>
      </div>
    </div>
  )
}
