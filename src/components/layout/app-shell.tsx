import type { ReactNode } from "react"

import { TopNav } from "@/components/layout/top-nav"
import { Toaster } from "@/components/ui/sonner"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-svh bg-background">
      <div aria-hidden className="app-mesh" />
      <div className="relative z-10">
        <TopNav />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
