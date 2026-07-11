import { Boxes } from "lucide-react"
import { Link } from "react-router-dom"
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/clerk-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { useScrolled } from "@/hooks/use-scrolled"
import { cn } from "@/lib/utils"

export function TopNav() {
  const scrolled = useScrolled(8)

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-background/80 transition-[backdrop-filter,background-color] duration-150",
        scrolled && "backdrop-blur-md supports-[backdrop-filter]:bg-background/70",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground"
        >
          <Boxes className="size-[18px] text-primary" aria-hidden />
          <span className="text-gradient">EnvShare</span>
        </Link>
        <nav className="flex items-center gap-1">
          <SignedOut>
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-[length:var(--radius-button)] px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                Sign in
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="mr-1">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
