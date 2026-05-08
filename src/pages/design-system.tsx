import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const sectionMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-24 space-y-6"
      {...sectionMotion}
    >
      <div className="space-y-1.5 border-b border-border/70 pb-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </motion.section>
  )
}

export function DesignSystemPage() {
  return (
    <div className="space-y-16">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Design system
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Components & tokens
        </h1>
        <p className="max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
          EnvShare uses neutral surfaces with an emerald primary. Mono type is
          reserved for environment keys and values.
        </p>
        <p className="font-mono text-[13px] leading-relaxed text-muted-foreground">
          DATABASE_URL=&quot;postgresql://user:pass@host:5432/db&quot;
        </p>
      </motion.div>

      <Section
        id="buttons"
        title="Buttons"
        description="Variants and sizes from the shared button recipe. Icon sizes inherit when nested."
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Variants</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link" className="px-0" asChild>
                <a href="#buttons">Link style</a>
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Sizes</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon-xs" aria-label="Compact icon">
                <span className="text-xs font-semibold">E</span>
              </Button>
              <Button size="icon-sm" aria-label="Small icon">
                <span className="text-xs font-semibold">S</span>
              </Button>
              <Button size="icon" aria-label="Icon">
                <span className="text-xs font-semibold">M</span>
              </Button>
              <Button size="icon-lg" aria-label="Large icon">
                <span className="text-xs font-semibold">L</span>
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Disabled & loading affordances
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled>Disabled</Button>
              <Button variant="outline" disabled>
                Disabled outline
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="cards"
        title="Cards"
        description="Structured surfaces for summaries, settings panels, and lists."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
              <CardDescription>
                Card description uses muted foreground for supporting copy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Main body keeps comfortable line length and rhythm.</p>
            </CardContent>
            <CardFooter className="border-t border-border/60 bg-muted/30 py-3 text-xs text-muted-foreground">
              Footer slot for metadata or actions.
            </CardFooter>
          </Card>
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Compact</CardTitle>
              <CardDescription>
                Pair cards with buttons or inputs for dense dashboards.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary">
                Secondary
              </Button>
              <Button size="sm">Primary</Button>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        id="inputs"
        title="Inputs"
        description="Form controls with labels and monospace samples for secret values."
      >
        <div className="grid max-w-xl gap-6">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" placeholder="acme-api" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-url">Endpoint</Label>
            <Input
              id="api-url"
              className="font-mono text-[13px]"
              placeholder="https://api.example.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={4}
              placeholder="Optional context for teammates…"
              className="min-h-[120px] resize-y text-[14px] leading-relaxed"
            />
          </div>
        </div>
      </Section>

      <Section
        id="dialog"
        title="Dialog"
        description="Modal pattern for confirmations and short forms without leaving the page."
      >
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rotate API key</DialogTitle>
              <DialogDescription>
                This is a sample dialog. In the product, confirming here would
                call your API and invalidate the previous key.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="button">Continue</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Section>

      <Section
        id="toast"
        title="Toast"
        description="Sonner toasts for async feedback — success, errors, and promises."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => toast.success("Variables synced")}
          >
            Success
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              toast.error("Could not reach the sync service", {
                description: "Try again in a few seconds.",
              })
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              toast.promise(
                new Promise((resolve) => setTimeout(resolve, 1200)),
                {
                  loading: "Saving environment…",
                  success: "Saved to project",
                  error: "Save failed",
                },
              )
            }
          >
            Promise
          </Button>
        </div>
      </Section>

      <Section
        id="typography"
        title="Typography"
        description="Inter for UI copy; JetBrains Mono for machine-readable values."
      >
        <div className="grid max-w-xl gap-6 rounded-xl border border-border/80 bg-card/50 p-6 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Sans / UI
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">
              Inter carries headings, body text, and navigation. Keep line length
              around 65–75 characters for readability.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Mono / env
            </p>
            <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted-foreground">
              STRIPE_SECRET_KEY=sk_live_••••••••••••••
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
