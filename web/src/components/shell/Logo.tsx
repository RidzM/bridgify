import { Link } from 'react-router'

/** Wordmark with the braille cell for "b" (dots 1 and 2 raised). */
export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-[8px] text-ink no-underline" aria-label="Bridgify home">
      <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden>
        <circle cx="6" cy="6" r="4" fill="var(--brand)" />
        <circle cx="6" cy="15" r="4" fill="var(--brand)" />
        <circle cx="6" cy="24" r="3.25" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
        <circle cx="16" cy="6" r="3.25" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
        <circle cx="16" cy="15" r="3.25" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
        <circle cx="16" cy="24" r="3.25" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" />
      </svg>
      <span className="text-[1.25rem] font-semibold tracking-[-0.02em]">Bridgify</span>
    </Link>
  )
}
