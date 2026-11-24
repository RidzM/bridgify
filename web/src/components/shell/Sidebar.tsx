import { Link, NavLink } from 'react-router'
import { SlidersHorizontal, Siren } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { usePrefs } from '@/stores/prefs'
import { Logo } from './Logo'

const item = ({ isActive }: { isActive: boolean }) =>
  `press flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[0.9375rem] no-underline ${
    isActive ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
  }`

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const hidden = usePrefs((s) => s.hiddenTools)
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {NAV.map((g, gi) => {
        const items = g.items.filter((i) => !i.tool || !hidden.includes(i.tool))
        if (!items.length) return null
        return (
          <div key={gi} role="group" aria-labelledby={g.label ? `nav-${gi}` : undefined}>
            {g.label && <p id={`nav-${gi}`} className="mb-1.5 px-3 text-[0.8125rem] font-medium text-ink-muted">{g.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.to === '/'} className={item} onClick={onNavigate}>
                    <i.icon aria-hidden size={18} strokeWidth={1.75} className="shrink-0" />
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

export function Sidebar({ onDisplay }: { onDisplay: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-3 py-4 lg:flex">
      <div className="flex items-center justify-between gap-2 pb-6 pl-2">
        <Logo />
        <Link to="/sos" className="press inline-flex min-h-10 items-center gap-1.5 rounded-[8px] bg-danger px-3 text-[0.9375rem] font-medium text-danger-ink no-underline hover:opacity-90">
          <Siren aria-hidden size={16} strokeWidth={1.75} /> SOS
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto pr-1"><NavList /></div>
      <button type="button" onClick={onDisplay} className="press mt-4 flex min-h-11 items-center gap-3 rounded-[8px] px-3 text-ink-muted hover:bg-surface-2 hover:text-ink">
        <SlidersHorizontal aria-hidden size={18} strokeWidth={1.75} /> Display settings
      </button>
    </aside>
  )
}
