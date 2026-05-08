import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  countDiffChanges,
  type FileDiff,
  type ProjectDiff,
} from "@/lib/env-diff"
import { cn } from "@/lib/utils"

interface DiffViewProps {
  diff: ProjectDiff
}

export function DiffView({ diff }: DiffViewProps) {
  const totalChanges = countDiffChanges(diff)
  const [revealValues, setRevealValues] = useState(false)

  if (totalChanges === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-[13px] text-muted-foreground">No changes detected.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] tracking-wide text-muted-foreground">
          {totalChanges} change{totalChanges === 1 ? "" : "s"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setRevealValues((current) => !current)}
        >
          {revealValues ? (
            <EyeOff className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
          {revealValues ? "Hide values" : "Show values"}
        </Button>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
        {diff.addedFiles.map((env) => (
          <DiffBlock
            key={`added-${env.filename}`}
            tone="added"
            heading={`+ ${env.filename}`}
            subheading={`new file · ${env.variables.length} variable${env.variables.length === 1 ? "" : "s"}`}
          >
            <ul className="space-y-1">
              {env.variables.map((v) => (
                <li
                  key={v.key}
                  className="flex items-baseline gap-2 font-mono text-[12px]"
                >
                  <span className="text-emerald-700 dark:text-emerald-400">+</span>
                  <span className="text-foreground">{v.key}</span>
                  <Value value={v.value} reveal={revealValues} />
                </li>
              ))}
            </ul>
          </DiffBlock>
        ))}

        {diff.removedFiles.map((env) => (
          <DiffBlock
            key={`removed-${env.filename}`}
            tone="removed"
            heading={`- ${env.filename}`}
            subheading={`removed · ${env.variables.length} variable${env.variables.length === 1 ? "" : "s"}`}
          >
            <ul className="space-y-1">
              {env.variables.map((v) => (
                <li
                  key={v.key}
                  className="flex items-baseline gap-2 font-mono text-[12px]"
                >
                  <span className="text-rose-700 dark:text-rose-400">-</span>
                  <span className="text-foreground line-through decoration-rose-400/60">
                    {v.key}
                  </span>
                </li>
              ))}
            </ul>
          </DiffBlock>
        ))}

        {diff.modifiedFiles.map((file) => (
          <ModifiedFileBlock
            key={`modified-${file.filename}`}
            file={file}
            reveal={revealValues}
          />
        ))}
      </div>
    </div>
  )
}

function DiffBlock({
  tone,
  heading,
  subheading,
  children,
}: {
  tone: "added" | "removed" | "modified"
  heading: string
  subheading?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "added" && "border-emerald-500/30 bg-emerald-500/5",
        tone === "removed" && "border-rose-500/30 bg-rose-500/5",
        tone === "modified" && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="mb-1.5">
        <p className="font-mono text-[12px] font-medium">{heading}</p>
        {subheading ? (
          <p className="text-[11px] text-muted-foreground">{subheading}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function ModifiedFileBlock({
  file,
  reveal,
}: {
  file: FileDiff
  reveal: boolean
}) {
  const totalFile =
    file.added.length + file.removed.length + file.changed.length
  return (
    <DiffBlock
      tone="modified"
      heading={`~ ${file.filename}`}
      subheading={`${totalFile} change${totalFile === 1 ? "" : "s"}`}
    >
      <ul className="space-y-1">
        {file.added.map((v) => (
          <li
            key={`add-${v.key}`}
            className="flex items-baseline gap-2 font-mono text-[12px]"
          >
            <span className="text-emerald-700 dark:text-emerald-400">+</span>
            <span className="text-foreground">{v.key}</span>
            <Value value={v.value} reveal={reveal} />
          </li>
        ))}
        {file.removed.map((v) => (
          <li
            key={`rm-${v.key}`}
            className="flex items-baseline gap-2 font-mono text-[12px]"
          >
            <span className="text-rose-700 dark:text-rose-400">-</span>
            <span className="text-foreground line-through decoration-rose-400/60">
              {v.key}
            </span>
          </li>
        ))}
        {file.changed.map((c) => (
          <li
            key={`ch-${c.key}`}
            className="flex flex-wrap items-baseline gap-2 font-mono text-[12px]"
          >
            <span className="text-amber-700 dark:text-amber-400">~</span>
            <span className="text-foreground">{c.key}</span>
            <Value value={c.oldValue} reveal={reveal} tone="old" />
            <span className="text-muted-foreground">→</span>
            <Value value={c.newValue} reveal={reveal} tone="new" />
          </li>
        ))}
      </ul>
    </DiffBlock>
  )
}

function Value({
  value,
  reveal,
  tone,
}: {
  value: string
  reveal: boolean
  tone?: "old" | "new"
}) {
  if (value === "") {
    return (
      <span className="text-[11px] italic text-muted-foreground">empty</span>
    )
  }
  return (
    <span
      className={cn(
        "max-w-[180px] truncate text-[12px]",
        !reveal && "blur-[5px] select-none",
        tone === "old" && "text-rose-700 dark:text-rose-400",
        tone === "new" && "text-emerald-700 dark:text-emerald-400",
        !tone && "text-muted-foreground",
      )}
      title={reveal ? value : undefined}
    >
      {value}
    </span>
  )
}
