import { useEffect, useState, Suspense } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { TopBar } from '@/components/shell/TopBar'
import { PersonalizePanel } from '@/features/personalize/PersonalizePanel'
import { TutorialsPanel } from '@/features/tutorials/TutorialsPanel'
import { ToastRegion } from '@/components/ui/Toast'
import { ErrorBoundary } from './ErrorBoundary'
import { usePrefs, applyPrefsToDocument } from '@/stores/prefs'

function usePrefsOnDocument() {
  const { mode, textScale, underlineLinks, largeCursor, motion } = usePrefs()
  useEffect(() => {
    applyPrefsToDocument({ mode, textScale, underlineLinks, largeCursor, motion })
  }, [mode, textScale, underlineLinks, largeCursor, motion])
}

export function AppShell() {
  usePrefsOnDocument()
  const [pz, setPz] = useState(false)
  const [tu, setTu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[var(--radius-control)] focus:bg-brand focus:px-4 focus:py-3 focus:text-brand-ink">
        Skip to content
      </a>
      <TopBar onPersonalize={() => setPz(true)} onTutorials={() => setTu(true)} />
      <main id="content" tabIndex={-1} className="flex-1 outline-none">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<p className="mx-auto max-w-[1200px] px-6 py-10 text-ink-muted">Loading…</p>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="focus-dim border-t border-line">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-muted md:px-6">
          <span>Bridgify · VCET Computer Engineering mini project, 2025–26</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
            <Link to="/about/privacy">Privacy</Link>
            <Link to="/about/evidence">Evidence</Link>
            <Link to="/about/credits">Credits</Link>
          </nav>
        </div>
      </footer>
      <PersonalizePanel open={pz} onOpenChange={setPz} />
      <TutorialsPanel open={tu} onOpenChange={setTu} />
      <ToastRegion />
    </div>
  )
}
