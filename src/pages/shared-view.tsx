import { motion } from "framer-motion"
import { Link, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function SharedViewPage() {
  const { shareCode } = useParams<{ shareCode: string }>()

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Shared link
        </p>
        <h1 className="font-mono text-2xl font-medium tracking-tight text-foreground">
          {shareCode ?? "—"}
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Read-only shared environment placeholder. Scoped values and expiry will
          be configured later.
        </p>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </motion.div>
  )
}
