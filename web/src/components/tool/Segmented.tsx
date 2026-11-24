import { useId } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'

interface Props<T extends string> { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }

export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const id = useId()
  return (
    <div>
      <p id={id} className="mb-1.5 text-[0.875rem] font-medium text-ink-muted">{label}</p>
      <RadioGroup aria-labelledby={id} value={value} onValueChange={(v) => onChange(v as T)} className="inline-flex flex-wrap gap-1 rounded-[10px] border border-line bg-bg p-1">
        {options.map((o) => (
          <Radio.Root key={o.id} value={o.id} className="press min-h-10 rounded-[8px] px-3.5 text-[0.9375rem] text-ink-muted hover:text-ink data-[checked]:bg-surface data-[checked]:font-medium data-[checked]:text-ink data-[checked]:shadow-[0_0_0_1px_var(--line)]">
            {o.label}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  )
}
