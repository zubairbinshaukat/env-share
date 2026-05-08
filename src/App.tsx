import { AnimatePresence, motion } from "framer-motion"
import { Route, Routes } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react"

import { LandingPage } from "@/components/auth/landing"
import { AppShell } from "@/components/layout/app-shell"
import { MigrationPrompt } from "@/components/migration-prompt"
import { DashboardPage } from "@/pages/dashboard"
import { DesignSystemPage } from "@/pages/design-system"
import { ProjectViewPage } from "@/pages/project-view"
import { SharedViewPage } from "@/pages/shared-view"

export default function App() {
  const location = useLocation()

  return (
    <AppShell>
      <SignedIn>
        <MigrationPrompt />
      </SignedIn>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Routes location={location}>
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
        </motion.div>
      </AnimatePresence>
    </AppShell>
  )
}
