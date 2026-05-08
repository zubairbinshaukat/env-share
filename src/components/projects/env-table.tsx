import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/env-export"
import { cn } from "@/lib/utils"
import type { EnvVariable } from "@/lib/types"

interface EnvTableProps {
  variables: EnvVariable[]
  /** When true, all rows are revealed regardless of per-row state. */
  revealAll: boolean
}

export function EnvTable({ variables, revealAll }: EnvTableProps) {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})

  if (variables.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center text-[13px] text-muted-foreground">
        No variables in this environment.
      </div>
    )
  }

  function toggleRow(idx: number) {
    setOverrides((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
      <div className="grid grid-cols-[minmax(140px,_1fr)_2fr_auto] items-center gap-3 border-b border-border/60 bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>Key</span>
        <span>Value</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y divide-border/60">
        {variables.map((v, idx) => (
          <EnvTableRow
            key={`${v.key}-${idx}`}
            variable={v}
            visible={revealAll || overrides[idx] === true}
            onToggle={() => toggleRow(idx)}
          />
        ))}
      </ul>
    </div>
  )
}

function EnvTableRow({
  variable,
  visible,
  onToggle,
}: {
  variable: EnvVariable
  visible: boolean
  onToggle: () => void
}) {
  const [copied, setCopied] = useState(false)
  const masked = useMemo(() => maskValue(variable.value), [variable.value])

  async function handleCopy() {
    try {
      await copyToClipboard(variable.value)
      setCopied(true)
      toast.success(`Copied ${variable.key}`)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      toast.error("Could not copy value")
    }
  }

  return (
    <li className="grid grid-cols-[minmax(140px,_1fr)_2fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/30">
      <code className="truncate font-mono text-[12.5px] font-medium text-foreground">
        {variable.key}
      </code>
      <code
        className={cn(
          "truncate font-mono text-[12.5px]",
          visible
            ? "text-foreground"
            : "text-muted-foreground",
        )}
        title={visible ? variable.value : undefined}
      >
        {visible ? variable.value || <span className="opacity-60">""</span> : masked}
      </code>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onToggle}
          aria-label={visible ? "Hide value" : "Show value"}
        >
          {visible ? (
            <EyeOff className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleCopy}
          aria-label="Copy value"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </Button>
      </div>
    </li>
  )
}

function maskValue(value: string): string {
  if (value.length === 0) return "—"
  // Render a fixed-width-ish masked block so layout stays steady.
  const len = Math.max(8, Math.min(value.length, 24))
  return "•".repeat(len)
}
