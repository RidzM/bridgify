import { NavLink } from 'react-router'

export function LessonTabs({ base, tabs }: { base: string; tabs: { id: string; label: string }[] }) {
  return (
    <nav aria-label="Lesson sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <NavLink key={t.id} to={`${base}/${t.id}`} replace
          className={({ isActive }) => `-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 no-underline ${isActive ? 'border-brand font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
