import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'live'
type Size = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 min-h-11 min-w-11 rounded-[var(--radius-control)] font-medium select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90 px-4',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2 px-4',
  quiet: 'text-ink hover:bg-surface-2 px-3',
  danger: 'bg-danger text-danger-ink hover:opacity-90 px-4',
  live: 'bg-live-fill text-white px-4',
}
const sizes: Record<Size, string> = { md: 'text-base', lg: 'text-lg min-h-14 px-6' }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  )
})
