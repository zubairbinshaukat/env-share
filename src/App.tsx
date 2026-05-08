import { Route, Routes } from "react-router-dom"
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react"

import { LandingPage } from "@/components/auth/landing"
import { AppShell } from "@/components/layout/app-shell"
import { MigrationPrompt } from "@/components/migration-prompt"
import { DashboardPage } from "@/pages/dashboard"
import { DesignSystemPage } from "@/pages/design-system"
import { ProjectViewPage } from "@/pages/project-view"
import { SharedViewPage } from "@/pages/shared-view"

export default function App() {
  return (
    <AppShell>
      <SignedIn>
        <MigrationPrompt />
      </SignedIn>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <SignedOut>
                <LandingPage />
              </SignedOut>
              <SignedIn>
                <DashboardPage />
              </SignedIn>
            </>
          }
        />
        <Route
          path="/project/:shareCode"
          element={
            <>
              <SignedIn>
                <ProjectViewPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />
        <Route path="/s/:shareCode" element={<SharedViewPage />} />
        <Route path="/design" element={<DesignSystemPage />} />
      </Routes>
    </AppShell>
  )
}
