import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import { EnvTable } from "@/components/projects/env-table"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { decryptJSON, importKeyB64 } from "@/lib/crypto"
import { getKeyFromHash } from "@/lib/share-link"
import type { ProjectEnvironment } from "@/lib/types"

export function SharedViewPage() {
  const api = useApi()
  const { shareCode } = useParams<{ shareCode: string }>()
  const hashKey = getKeyFromHash()
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([])

  useEffect(() => {
    if (!shareCode || !hashKey) {
      return
    }

    api.getSharedProject(shareCode)
      .then(async (record) => {
        const key = await importKeyB64(hashKey)
        const decrypted = await decryptJSON<ProjectEnvironment[]>(key, {
          ciphertext: record.ciphertext,
          iv: record.iv,
        })
        setProjectName(record.name)
        setEnvironments(decrypted)
        setState("ready")
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load shared project")
        setState("error")
      })
  }, [api, shareCode, hashKey])

  if (!shareCode) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Unable to open shared project</h1>
        <p className="text-sm text-muted-foreground">Missing share code.</p>
      </div>
    )
  }

  if (!hashKey) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Unable to open shared project</h1>
        <p className="text-sm text-muted-foreground">
          Missing decryption key in URL fragment.
        </p>
      </div>
    )
  }

  if (state === "loading") {
    return <div className="text-sm text-muted-foreground">Loading shared project...</div>
  }

  if (state === "error") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-foreground">Unable to open shared project</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Shared project
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{projectName}</h1>
      </div>
      {environments.map((env) => (
        <section key={env.id} className="space-y-2">
          <h2 className="font-mono text-sm text-foreground">{env.filename}</h2>
          <EnvTable variables={env.variables} revealAll />
        </section>
      ))}
    </div>
  )
}
