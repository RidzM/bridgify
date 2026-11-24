import type { ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'

export function Select({ label, children, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.875rem] font-medium text-ink-muted">{label}</label>
      <div className="relative">
        <select id={id} className="min-h-11 w-full appearance-none rounded-[8px] border border-line bg-surface py-2 pl-3 pr-9 text-ink outline-none hover:border-line-strong focus:border-brand" {...rest}>
          {children}
        </select>
        <ChevronDown aria-hidden size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </div>
    </div>
  )
}

export function Panel({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`rounded-[16px] border border-line bg-surface ${className}`}>
      {children}
    </section>
  )
}
