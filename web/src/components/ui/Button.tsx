import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'live'
type Size = 'md' | 'lg'

const base =
  'press inline-flex items-center justify-center gap-2 min-h-11 min-w-11 rounded-[8px] font-medium select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90 px-4',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong px-4',
  quiet: 'text-ink hover:bg-surface-2 px-3',
  danger: 'bg-danger text-danger-ink hover:opacity-90 px-4',
  live: 'bg-live-fill text-white px-4',
}
const sizes: Record<Size, string> = { md: 'text-[0.9375rem]', lg: 'text-base min-h-12 px-5' }

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
