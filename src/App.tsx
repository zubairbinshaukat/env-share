import { useEffect } from "react"
import { Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { ensureUserId } from "@/lib/local"
import { DashboardPage } from "@/pages/dashboard"
import { DesignSystemPage } from "@/pages/design-system"
import { ProjectViewPage } from "@/pages/project-view"
import { SharedViewPage } from "@/pages/shared-view"
import { useProjectsStore } from "@/store/projects-store"

export default function App() {
  const hydrate = useProjectsStore((s) => s.hydrate)

  useEffect(() => {
    ensureUserId()
    hydrate()
  }, [hydrate])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/project/:id" element={<ProjectViewPage />} />
        <Route path="/s/:shareCode" element={<SharedViewPage />} />
        <Route path="/design" element={<DesignSystemPage />} />
      </Routes>
    </AppShell>
  )
}
