import { Lock, FolderUp, Share2 } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { SignUpButton } from "@clerk/clerk-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseShareInput(shareInput)
    if (!parsed?.shareCode) {
      toast.error("Enter a valid share code or share URL")
      return
    }
    const suffix = parsed.key ? `#key=${encodeURIComponent(parsed.key)}` : ""
    navigate(`/s/${encodeURIComponent(parsed.shareCode)}${suffix}`)
  }

  return (
    <section className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-4 text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Share .env files with your team. Securely.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Keep project secrets organized and send encrypted read-only links to
          teammates without forcing sign-in.
        </p>
        <SignUpButton mode="modal">
          <Button size="lg">Get started</Button>
        </SignUpButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <article
            key={step.title}
            className="rounded-xl border border-border/70 bg-card/70 p-4"
          >
            <step.icon className="size-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-foreground">
              {step.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
          </article>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-2">
        <label
          htmlFor="shareCodeInput"
          className="text-sm font-medium text-muted-foreground"
        >
          Have a share code? Paste it here
        </label>
        <div className="flex gap-2">
          <Input
            id="shareCodeInput"
            value={shareInput}
            onChange={(event) => setShareInput(event.target.value)}
            placeholder="Paste share link or share code"
            autoComplete="off"
          />
          <Button type="submit" variant="outline">
            Open
          </Button>
        </div>
      </form>
    </section>
  )
}
