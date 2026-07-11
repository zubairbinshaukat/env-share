import { motion } from "framer-motion"
import { Copy, Download, Link2Off } from "lucide-react"
import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { EnvTable } from "@/components/projects/env-table"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/lib/api"
import { copyToClipboard, downloadEnvFile, serializeEnv } from "@/lib/env-export"
import { decryptJSON, importKeyB64 } from "@/lib/crypto"
import { getKeyFromHash } from "@/lib/share-link"
import type { ProjectEnvironment } from "@/lib/types"

export function SharedViewPage() {
  const api = useApi()
  const { shareCode } = useParams<{ shareCode: string }>()
  const hashKey = getKeyFromHash()
  const [state, setState] = useState<
    "loading" | "ready" | "not-found" | "network-error" | "decrypt-error"
  >("loading")
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([])
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined)
  const [revealAll, setRevealAll] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const currentEnv = environments.find((env) => env.id === activeFile) ?? environments[0]

  useEffect(() => {
    if (!shareCode) return
    if (!hashKey) return

    api
      .getSharedProject(shareCode)
      .then(async (record) => {
        const key = await importKeyB64(hashKey)
        const decrypted = await decryptJSON<ProjectEnvironment[]>(key, {
          ciphertext: record.ciphertext,
          iv: record.iv,
        })
        setProjectName(record.name)
        setEnvironments(decrypted)
        setActiveFile(decrypted[0]?.id)
        setState("ready")
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load shared project"
        setError(message)
        if (/404|not found|doesn't exist/i.test(message)) {
          setState("not-found")
          return
        }
        if (/decrypt|key|cipher|iv/i.test(message)) {
          setState("decrypt-error")
          return
        }
        setState("network-error")
      })
  }, [api, shareCode, hashKey])

  useEffect(() => {
    if (state !== "loading") return
    const timer = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(timer)
  }, [state])

  if (!shareCode) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Unable to open shared project
        </h1>
        <p className="text-[14px] text-muted-foreground">Missing share code.</p>
      </div>
    )
  }

  if (!hashKey) {
    return <ShareErrorState title="Couldn't decrypt this project" description="The decryption key is missing or invalid. Make sure you opened the full share link." />
  }

  if (state === "loading" && !timedOut) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-1/2 animate-pulse rounded-md bg-muted/70" />
        <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted/50" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    )
  }

  if (state === "not-found") {
    return (
      <ShareErrorState
        title="This share link doesn't exist"
        description="It may have been deleted or the URL is incorrect."
      />
    )
  }

  if (state === "decrypt-error") {
    return (
      <ShareErrorState
        title="Couldn't decrypt this project"
        description="The decryption key is missing or invalid. Make sure you opened the full share link."
      />
    )
  }

  if (state === "network-error" || timedOut) {
    return (
      <div className="space-y-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Couldn't load this project</h1>
        <p className="text-[14px] text-muted-foreground">
          {timedOut ? "Check your connection and try again." : (error ?? "Check your connection and try again.")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTimedOut(false)
            setState("loading")
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Helmet>
        <title>{projectName} - shared via EnvShare</title>
      </Helmet>
      <div className="mx-auto max-w-4xl space-y-10 px-2 py-8 sm:py-12">
        <div className="space-y-3">
          <p className="text-gradient text-xs font-medium tracking-[0.2em]">SHARED PROJECT</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{projectName}</h1>
          <p className="text-sm text-muted-foreground">
            Shared via EnvShare · {environments.length} environments
          </p>
          <div className="h-px w-full bg-border" />
        </div>

        <Tabs value={currentEnv?.id} onValueChange={setActiveFile}>
          <TabsList className="h-auto flex-wrap rounded-none bg-transparent p-0">
            {environments.map((env) => (
              <TabsTrigger
                key={env.id}
                value={env.id}
                className="rounded-none border-x-0 border-t-0 border-b-2 border-transparent px-2 font-mono text-[12px] data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {env.filename}
              </TabsTrigger>
            ))}
          </TabsList>

          {environments.map((env) => (
            <TabsContent key={env.id} value={env.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await copyToClipboard(serializeEnv(env.variables))
                    toast.success(`Copied ${env.filename}`)
                  }}
                >
                  <Copy className="size-4" />
                  Copy all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadEnvFile(env.filename, `${serializeEnv(env.variables)}\n`)
                    toast.success(`Downloaded ${env.filename}`)
                  }}
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
              <EnvTable
                variables={env.variables}
                revealAll={revealAll}
                onRevealAllChange={setRevealAll}
                envName={env.filename}
              />
            </TabsContent>
          ))}
        </Tabs>

        <footer className="mt-24 border-t border-border pt-6 text-sm text-muted-foreground">
          Want your own? Create projects at{" "}
          <Link className="text-foreground underline-offset-4 hover:underline" to="/">
            EnvShare
          </Link>
        </footer>
      </div>
    </motion.div>
  )
}

function ShareErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Link2Off className="size-7 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-md text-[14px] text-muted-foreground">{description}</p>
      <Button asChild variant="outline" size="sm" className="mt-6">
        <Link to="/">Go to homepage</Link>
      </Button>
    </div>
  )
}
