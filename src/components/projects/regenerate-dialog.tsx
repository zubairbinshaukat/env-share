import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RegenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  busy?: boolean
}

export function RegenerateDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: RegenerateDialogProps) {
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
          <DialogTitle>Regenerate share link?</DialogTitle>
          <DialogDescription>
            This invalidates the current share link. Anyone with the old link
            will lose access. The project's environments stay intact.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" loading={busy} onClick={() => onConfirm()}>
            {busy ? "Regenerating…" : "Generate new link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
