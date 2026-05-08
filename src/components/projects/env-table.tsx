import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/env-export"
import { cn } from "@/lib/utils"
import type { EnvVariable } from "@/lib/types"

interface EnvTableProps {
  variables: EnvVariable[]
  revealAll: boolean
  onRevealAllChange: (next: boolean) => void
  envName?: string
}

export function EnvTable({
  variables,
  revealAll,
  onRevealAllChange,
  envName = ".env",
}: EnvTableProps) {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const [focusedRow, setFocusedRow] = useState<number | null>(null)
  const visibleMap = useMemo(
    () => variables.map((_, idx) => revealAll || overrides[idx] === true),
    [overrides, revealAll, variables],
  )

  if (variables.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-[13px] text-muted-foreground">
          No variables in this environment.
        </p>
      </div>
    )
  }

  function toggleRow(idx: number) {
    setOverrides((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border"
      onKeyDown={async (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && focusedRow !== null) {
          event.preventDefault()
          const variable = variables[focusedRow]
          if (!variable) return
          await copyToClipboard(variable.value)
          toast.success(`Copied ${variable.key}`)
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        <code className="font-mono text-[12px] text-muted-foreground">{envName}</code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRevealAllChange(!revealAll)}
          aria-label={revealAll ? "Hide all values" : "Show all values"}
        >
          {revealAll ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {revealAll ? "Hide all" : "Show all"}
        </Button>
      </div>
      <table className="min-w-full border-collapse">
        <thead className="border-b border-border bg-muted/20 text-left">
          <tr>
            <th className="px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground">KEY</th>
            <th className="px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground">VALUE</th>
            <th className="w-[96px] px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {variables.map((v, idx) => (
            <EnvTableRow
              key={`${v.key}-${idx}`}
              variable={v}
              visible={visibleMap[idx]}
              onToggle={() => toggleRow(idx)}
              onFocus={() => setFocusedRow(idx)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EnvTableRow({
  variable,
  visible,
  onToggle,
  onFocus,
}: {
  variable: EnvVariable
  visible: boolean
  onToggle: () => void
  onFocus: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await copyToClipboard(variable.value)
      setCopied(true)
      toast.success(`Copied ${variable.key}`)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy value")
    }
  }

  const shown =
    variable.value.length === 0 ? (
      <span className="text-muted-foreground">empty</span>
    ) : (
      variable.value
    )

  return (
    <tr
      tabIndex={0}
      onFocus={onFocus}
      className="group border-b border-border/70 transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40"
    >
      <td className="px-4 py-3">
        <code className="font-mono text-[13px] font-medium text-foreground">
        {variable.key}
        </code>
      </td>
      <td className="max-w-[1px] px-4 py-3">
        <code
          className={cn(
            "block truncate font-mono text-[13px]",
            visible ? "text-foreground" : "blur-[6px] select-none",
          )}
          title={visible ? variable.value : undefined}
        >
          {visible ? shown : variable.value || "••••••••"}
        </code>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={visible ? "Hide value" : "Show value"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copy value"
        >
          {copied ? (
            <Check className="size-4 text-primary" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
        </div>
      </td>
    </tr>
  )
}
