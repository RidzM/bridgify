import { Link, NavLink } from 'react-router-dom'
import { SlidersHorizontal, BookOpen, Siren } from 'lucide-react'
import { Logo } from './Logo'

interface Props { onPersonalize: () => void; onTutorials: () => void }

const navLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 no-underline ${isActive ? 'font-bold text-ink underline decoration-2 underline-offset-8' : 'text-ink-muted hover:text-ink'}`

export function TopBar({ onPersonalize, onTutorials }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-16 w-full max-w-[1200px] flex-wrap items-center gap-1 px-3 py-1 md:gap-2 md:px-6">
        <Logo />
        <button
          type="button"
          onClick={onPersonalize}
          className="ml-1 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-3 text-ink hover:bg-surface-2"
        >
          <SlidersHorizontal aria-hidden size={18} />
          <span className="hidden sm:inline">Personalize</span>
          <span className="sr-only sm:hidden">Personalize</span>
        </button>
        <nav aria-label="Main" className="focus-dim ml-auto hidden items-center md:flex">
          <NavLink to="/tools" className={navLink}>Tools</NavLink>
          <NavLink to="/bridge" className={navLink}>Bridge</NavLink>
        </nav>
        <button
          type="button"
          onClick={onTutorials}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-ink hover:bg-surface-2 md:ml-0"
        >
          <BookOpen aria-hidden size={18} />
          <span className="hidden sm:inline">Tutorials</span>
          <span className="sr-only sm:hidden">Tutorials</span>
        </button>
        <Link
          to="/sos"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] bg-danger px-3 font-bold text-danger-ink no-underline hover:opacity-90"
        >
          <Siren aria-hidden size={18} /> SOS
        </Link>
      </div>
    </header>
  )
}
