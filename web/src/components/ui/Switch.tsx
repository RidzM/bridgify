import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { useId } from 'react'

export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      </label>
      <BaseSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v)}
        className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-line-strong bg-surface-2 transition-colors data-[checked]:border-brand data-[checked]:bg-brand"
      >
        <BaseSwitch.Thumb className="ml-0.5 block h-6 w-6 rounded-full bg-ink-muted transition-transform data-[checked]:translate-x-6 data-[checked]:bg-brand-ink" />
      </BaseSwitch.Root>
    </div>
  )
}
