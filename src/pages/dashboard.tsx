import { motion } from "framer-motion"
import { FolderPlus, PackageOpen, Plus, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Helmet } from "react-helmet-async"
import { useSearchParams } from "react-router-dom"

import { NewProjectDialog } from "@/components/projects/new-project-dialog"
import { ProjectCard } from "@/components/projects/project-card"
import { Button } from "@/components/ui/button"
import { useApi } from "@/lib/api"
import { useProjectsStore } from "@/store/projects-store"

export function DashboardPage() {
  const api = useApi()
  const projects = useProjectsStore((s) => s.projects)
  const loadingList = useProjectsStore((s) => s.loadingList)
  const error = useProjectsStore((s) => s.error)
  const fetchProjects = useProjectsStore((s) => s.fetchProjects)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialTab, setInitialTab] = useState<"folder" | "manual">("folder")
  const [timedOut, setTimedOut] = useState(false)
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [perPage, setPerPage] = useState(6)
  const [pagesShown, setPagesShown] = useState(1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [, setParams] = useSearchParams()

  const sorted = useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects],
  )
  const filtered = useMemo(() => {
    if (!debouncedQuery.trim()) return sorted
    const q = debouncedQuery.toLowerCase()
    return sorted.filter((project) => {
      const byName = project.name.toLowerCase().includes(q)
      const byShareCode = project.shareCode.toLowerCase().includes(q)
      const byFilename = (project.environmentFilenames ?? []).some((filename) =>
        filename.toLowerCase().includes(q),
      )
      return byName || byShareCode || byFilename
    })
  }, [debouncedQuery, sorted])
  const visibleCount = perPage * pagesShown
  const visibleProjects = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = visibleProjects.length < filtered.length

  function openDialog(tab: "folder" | "manual") {
    setInitialTab(tab)
    setDialogOpen(true)
  }

  useEffect(() => {
    fetchProjects(api)
  }, [api, fetchProjects])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 100)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!loadingList) return
    const timer = window.setTimeout(() => setTimedOut(true), 8000)
    return () => window.clearTimeout(timer)
  }, [loadingList])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openDialog("folder")
        return
      }
      if (event.key === "/" && event.target instanceof HTMLElement && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
        event.preventDefault()
        inputRef.current?.focus()
        return
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("")
        setParams({}, { replace: true })
        inputRef.current?.blur()
        setPagesShown(1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setParams])

  return (
    <motion.div
      className="space-y-12 sm:space-y-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Helmet>
        <title>Your projects - EnvShare</title>
      </Helmet>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
          Projects
        </h1>
        <Button type="button" onClick={() => openDialog("folder")}>
          <Plus className="size-4" />
          New project
        </Button>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const next = event.target.value
              setQuery(next)
              setPagesShown(1)
              if (next.trim()) {
                setParams({ q: next.trim() }, { replace: true })
              } else {
                setParams({}, { replace: true })
              }
            }}
            placeholder="Search projects..."
            className="h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-16 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Search projects"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setPagesShown(1)
                setParams({}, { replace: true })
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              /
            </kbd>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          Per page
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value))
              setPagesShown(1)
            }}
            className="h-10 min-w-24 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            aria-label="Projects per page"
          >
            {[6, 9, 12, 18].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingList && !timedOut ? (
        <LoadingState />
      ) : error || timedOut ? (
        <ErrorState
          message={
            timedOut ? "Couldn't load projects in time." : "Couldn't load projects."
          }
          onRetry={() => {
            setTimedOut(false)
            fetchProjects(api)
          }}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          onPickFolder={() => openDialog("folder")}
          onPickManual={() => openDialog("manual")}
        />
      ) : filtered.length === 0 ? (
        <SearchEmptyState
          query={debouncedQuery}
          onClear={() => {
            setQuery("")
            setPagesShown(1)
            setParams({}, { replace: true })
          }}
        />
      ) : (
        <div className="space-y-6">
          <motion.div
            key={`${debouncedQuery}-${perPage}-${visibleCount}`}
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visibleProjects.map((project) => (
              <ProjectCard key={project.shareCode} project={project} />
            ))}
          </motion.div>
          {hasMore ? (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPagesShown((current) => current + 1)}
              >
                Show more
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialTab={initialTab}
      />
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Loading your projects…</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-40 animate-pulse rounded-xl border border-border bg-muted/60"
          />
        ))}
      </div>
    </div>
  )
}

function SearchEmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">No projects match "{query}"</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Try a different search or clear to see all projects.
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-6" onClick={onClear}>
        Clear search
      </Button>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Couldn&apos;t load projects
      </h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <div className="mt-6">
        <Button type="button" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  )
}

function EmptyState({
  onPickFolder,
  onPickManual,
}: {
  onPickFolder: () => void
  onPickManual: () => void
}) {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <PackageOpen className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-6 text-[18px] font-semibold tracking-tight text-foreground">
        No projects yet
      </h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        Create your first project by importing from a folder or adding values manually.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={onPickFolder}>
          <FolderPlus className="size-4" />
          Create your first project
        </Button>
        <Button type="button" variant="outline" onClick={onPickManual}>
          <Plus className="size-4" />
          Create manually
        </Button>
      </div>
    </div>
  )
}
