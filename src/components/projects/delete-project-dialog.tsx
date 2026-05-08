import { useEffect, useState } from "react"

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

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  onConfirm: () => void | Promise<void>
  busy?: boolean
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  busy = false,
}: DeleteProjectDialogProps) {
  const [typed, setTyped] = useState("")

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped("")
    }
  }, [open])

  const matches = typed.trim() === projectName.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{projectName}"?</DialogTitle>
          <DialogDescription>
            This permanently deletes the project. Anyone with the share link will
            no longer be able to access it. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono">{projectName}</span> to confirm:
          </Label>
          <Input
            id="delete-confirm"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={projectName}
            autoComplete="off"
            disabled={busy}
          />
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
            variant="destructive"
            disabled={!matches || busy}
            onClick={() => onConfirm()}
          >
            {busy ? "Deleting…" : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
