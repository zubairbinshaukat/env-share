import type { ReactNode } from "react"

import { TopNav } from "@/components/layout/top-nav"
import { Toaster } from "@/components/ui/sonner"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-app-grid min-h-svh">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {children}
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
