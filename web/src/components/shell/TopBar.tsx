import { Link } from 'react-router-dom'
import { Menu, Siren, SlidersHorizontal } from 'lucide-react'
import { Logo } from './Logo'

interface Props { onMenu: () => void; onDisplay: () => void }

/** Top bar: logo and menu on small screens; on large screens the sidebar carries navigation. */
export function TopBar({ onMenu, onDisplay }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md lg:hidden">
      <div className="flex min-h-14 flex-wrap items-center gap-1 px-3 md:px-6">
        <button type="button" onClick={onMenu} className="press inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-surface-2 lg:hidden" aria-label="Open menu">
          <Menu aria-hidden size={22} strokeWidth={1.75} />
        </button>
        <div className="lg:hidden"><Logo /></div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onDisplay} className="press inline-flex min-h-11 items-center gap-2 rounded-[8px] px-3 text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden" aria-label="Display settings">
            <SlidersHorizontal aria-hidden size={18} strokeWidth={1.75} />
          </button>
          <Link to="/sos" className="press inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-danger px-3.5 font-medium text-danger-ink no-underline hover:opacity-90">
            <Siren aria-hidden size={18} strokeWidth={1.75} /> SOS
          </Link>
        </div>
      </div>
    </header>
  )
}
