import type { ButtonHTMLAttributes } from 'react'

export function Chip({ className = '', selected, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`press min-h-11 rounded-[8px] border px-3.5 py-1.5 text-[0.9375rem] ${
        selected ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink hover:border-line-strong'
      } ${className}`}
      {...rest}
    />
  )
}
