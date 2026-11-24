import type { ButtonHTMLAttributes } from 'react'

export function Chip({ className = '', selected, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 py-1.5 text-[0.95rem] transition-colors ${
        selected ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2'
      } ${className}`}
      {...rest}
    />
  )
}
