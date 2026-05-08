import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const VALID_LINE_RE = /^\s*(?:#.*|export\s+[A-Za-z_][A-Za-z0-9_.-]*\s*=.*|[A-Za-z_][A-Za-z0-9_.-]*\s*=.*)\s*$/

export type EnvEditMode = "add" | "edit"

interface EnvEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: EnvEditMode
  initial?: { filename: string; body: string }
  /** Filenames already used in the project (to prevent duplicates). */
  existingFilenames: string[]
  onSubmit: (filename: string, body: string) => void | Promise<void>
  busy?: boolean
}

export function EnvEditDialog({
  open,
  onOpenChange,
  mode,
  initial,
  existingFilenames,
  onSubmit,
  busy = false,
}: EnvEditDialogProps) {
  const [filename, setFilename] = useState(initial?.filename ?? ".env.local")
  const [body, setBody] = useState(initial?.body ?? "")

  // Reset only when the dialog transitions from closed -> open.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setFilename(initial?.filename ?? ".env.local")
      setBody(initial?.body ?? "")
    }
    wasOpenRef.current = open
  }, [open, initial])

  const trimmedFilename = filename.trim()
  const isDuplicate = useMemo(() => {
    if (!trimmedFilename) return false
    if (mode === "edit" && initial && initial.filename === trimmedFilename) {
      return false
    }
    return existingFilenames.includes(trimmedFilename)
  }, [existingFilenames, initial, mode, trimmedFilename])

  const invalidLines = useMemo(() => {
    const lines = body.split(/\r?\n/)
    const issues: number[] = []
    lines.forEach((line, idx) => {
      if (line.trim() === "") return
      if (!VALID_LINE_RE.test(line)) issues.push(idx + 1)
    })
    return issues
  }, [body])

  const filenameError = !trimmedFilename
    ? "Filename is required"
    : isDuplicate
      ? "A file with this name already exists"
      : null

  const submitDisabled =
    busy || !!filenameError || invalidLines.length > 0

  function buildHighlightedBody(): { line: string; valid: boolean }[] {
    return body.split(/\r?\n/).map((line) => ({
      line,
      valid: line.trim() === "" || VALID_LINE_RE.test(line),
    }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit environment" : "Add environment"}
          </DialogTitle>
          <DialogDescription>
            Paste the contents of an environment file. Lines like{" "}
            <code className="font-mono">KEY=value</code>, comments, and quoted values are
            supported.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="env-filename">Filename</Label>
            <Input
              id="env-filename"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              placeholder=".env.local"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              aria-invalid={Boolean(filenameError)}
            />
            {filenameError ? (
              <p className="text-[12px] text-destructive">{filenameError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="env-body">Variables</Label>
              {invalidLines.length > 0 ? (
                <p className="text-[11.5px] text-amber-700 dark:text-amber-400">
                  Line{invalidLines.length === 1 ? "" : "s"}{" "}
                  {invalidLines.join(", ")} look invalid
                </p>
              ) : null}
            </div>
            <div className="relative">
              <Textarea
                id="env-body"
                rows={10}
                spellCheck={false}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="font-mono text-[12.5px]"
                placeholder="API_KEY=xxx&#10;DATABASE_URL=postgres://..."
              />
            </div>
            {invalidLines.length > 0 ? (
              <details className="rounded-md bg-amber-500/5 px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-400">
                <summary className="cursor-pointer select-none">Show preview</summary>
                <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[11.5px]">
                  {buildHighlightedBody().map((entry, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded px-1",
                        !entry.valid && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
                      )}
                    >
                      <span className="mr-2 text-muted-foreground">{idx + 1}</span>
                      <span>{entry.line || " "}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={submitDisabled}
            onClick={() => onSubmit(trimmedFilename, body)}
          >
            {busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add environment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

