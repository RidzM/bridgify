import { Link } from 'react-router-dom'
import { BrailleCell } from './BrailleCell'

/** Wordmark with the braille cell for "b" (dots 1 2). */
export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 text-ink no-underline">
      <span className="inline-flex h-9 w-8 items-center justify-center rounded-[6px] bg-brand">
        <BrailleCell dots={[1, 2]} size={22} className="[&_.dot-raised]:fill-[var(--brand-ink)] [&_.dot-flat]:stroke-[var(--brand-ink)] [&_.dot-flat]:opacity-40" />
      </span>
      <span className="font-display text-[1.35rem] font-bold tracking-tight">Bridgify</span>
    </Link>
  )
}
