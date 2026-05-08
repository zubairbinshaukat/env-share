import { Boxes } from "lucide-react"
import { Link, NavLink } from "react-router-dom"

import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

function navClassName({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-accent text-accent-foreground"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  )
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground"
        >
          <Boxes className="size-[18px] text-primary" aria-hidden />
          EnvShare
        </Link>
        <nav className="flex items-center gap-0.5">
          <NavLink to="/design" className={navClassName} end={false}>
            Design
          </NavLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
