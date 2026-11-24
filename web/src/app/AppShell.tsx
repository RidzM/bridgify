import { useEffect, useState, Suspense } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { Sidebar, NavList } from '@/components/shell/Sidebar'
import { Logo } from '@/components/shell/Logo'
import { PersonalizePanel } from '@/features/personalize/PersonalizePanel'
import { ToastRegion } from '@/components/ui/Toast'
import { ErrorBoundary } from './ErrorBoundary'
import { usePrefs, applyPrefsToDocument } from '@/stores/prefs'

function usePrefsOnDocument() {
  const { mode, textScale, underlineLinks, largeCursor, motion } = usePrefs()
  useEffect(() => {
    applyPrefsToDocument({ mode, textScale, underlineLinks, largeCursor, motion })
  }, [mode, textScale, underlineLinks, largeCursor, motion])
}

function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/25 transition-opacity duration-[var(--dur-sheet)] ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-0 top-0 z-50 flex h-dvh w-[min(20rem,88vw)] flex-col bg-bg px-3 py-3 shadow-[var(--shadow-sheet)] transition-transform duration-[var(--dur-sheet)] ease-[var(--ease-out)] data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
          <div className="flex items-center justify-between px-2 pb-4">
            <Dialog.Title render={<div />}><Logo /></Dialog.Title>
            <Dialog.Close className="press inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-surface-2" aria-label="Close menu">
              <X aria-hidden size={22} strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto"><NavList onNavigate={() => onOpenChange(false)} /></div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AppShell() {
  usePrefsOnDocument()
  const [display, setDisplay] = useState(false)
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[8px] focus:bg-brand focus:px-4 focus:py-3 focus:text-brand-ink">
        Skip to content
      </a>
      <Sidebar onDisplay={() => setDisplay(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenu(true)} onDisplay={() => setDisplay(true)} />
        <main id="content" tabIndex={-1} className="min-h-[calc(100dvh-3.5rem)] flex-1 outline-none lg:min-h-dvh">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="focus-dim px-4 pb-8 pt-12 text-sm text-ink-muted md:px-8">
          <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-5 gap-y-2">
            <span>A VCET Computer Engineering mini project, 2025–26</span>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link to="/about" className="text-ink-muted">About</Link>
              <Link to="/about/privacy" className="text-ink-muted">Privacy</Link>
              <Link to="/about/evidence" className="text-ink-muted">Evidence</Link>
              <Link to="/about/credits" className="text-ink-muted">Credits</Link>
            </nav>
          </div>
        </footer>
      </div>
      <MobileNav open={menu} onOpenChange={setMenu} />
      <PersonalizePanel open={display} onOpenChange={setDisplay} />
      <ToastRegion />
    </div>
  )
}
