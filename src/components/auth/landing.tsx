import { SignUpButton } from "@clerk/clerk-react"
import { motion } from "framer-motion"
import { CheckCircle2, FolderUp, Lock, Share2 } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { Helmet } from "react-helmet-async"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { parseShareInput } from "@/lib/share-link"

const STEPS = [
  {
    title: "Import your env files",
    desc: "Create a project from a folder scan or manual paste.",
    icon: FolderUp,
  },
  {
    title: "Encrypt in your browser",
    desc: "Values are encrypted client-side before storage.",
    icon: Lock,
  },
  {
    title: "Share a private link",
    desc: "Recipients open the link and decrypt locally.",
    icon: Share2,
  },
] as const

export function LandingPage() {
  const navigate = useNavigate()
  const [shareInput, setShareInput] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseShareInput(shareInput)
    if (!parsed?.shareCode) {
      toast.error("Enter a valid share code or share URL")
      return
    }
    const suffix = parsed.key ? `#key=${encodeURIComponent(parsed.key)}` : ""
    navigate(`/s/${encodeURIComponent(parsed.shareCode)}${suffix}`)
    setDialogOpen(false)
  }

  return (
    <motion.section
      className="mx-auto max-w-5xl space-y-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Helmet>
        <title>EnvShare - Share .env files securely</title>
      </Helmet>
      <div className="relative space-y-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 -z-10 h-[420px] bg-[image:var(--gradient-hero)]"
        />
        <p className="text-gradient text-xs font-medium tracking-[0.2em]">ENVSHARE</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Share <span className="text-gradient">.env files</span> with your team.
        </h1>
        <p className="mx-auto max-w-xl text-[18px] leading-relaxed text-muted-foreground">
          Securely share environment variables via simple links. No setup for recipients. End-to-end encrypted.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SignUpButton mode="modal">
            <Button size="lg">Get started - it&apos;s free</Button>
          </SignUpButton>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" variant="outline">
                View a shared link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Open shared project</DialogTitle>
                <DialogDescription>Paste a share code or full URL.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <Input
                  value={shareInput}
                  onChange={(event) => setShareInput(event.target.value)}
                  placeholder="Paste share link or share code"
                  autoComplete="off"
                />
                <Button type="submit" className="w-full">
                  Open shared project
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground">No credit card - Free forever</p>
      </div>

      <div className="space-y-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, idx) => (
            <article
              key={step.title}
              className="rounded-xl border border-border/60 bg-card bg-[image:var(--gradient-card)] p-6 text-left transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              <p className="text-gradient text-4xl font-semibold">{String(idx + 1).padStart(2, "0")}</p>
              <step.icon className="mt-4 size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step.desc}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="my-12 flex flex-wrap items-center justify-center gap-6 border-y border-border py-6">
        {["End-to-end encrypted", "No tracking or analytics", "Open source"].map((item) => (
          <div key={item} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            {item}
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-8 text-sm text-muted-foreground">
        <span>© 2026 EnvShare</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com" className="hover:text-foreground">
            GitHub
          </a>
          <a href="#" className="hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="hover:text-foreground">
            Terms
          </a>
        </div>
      </footer>
    </motion.section>
  )
}
