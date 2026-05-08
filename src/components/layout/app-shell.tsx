import type { ReactNode } from "react"

import { TopNav } from "@/components/layout/top-nav"
import { Toaster } from "@/components/ui/sonner"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  )
}
