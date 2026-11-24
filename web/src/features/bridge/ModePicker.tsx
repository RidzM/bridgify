import { useId } from 'react'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'

interface Props<T extends string> {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (v: T) => void
  hint?: string
  className?: string
  /** Field-style label (1rem, ink) instead of the small muted control label. */
  strong?: boolean
  /** Two columns on phones (for long option labels that would leave one orphan on a row). */
  grid?: boolean
}

/** Segmented single choice (radio group) with a real label id, so multi-word labels work. */
export function ModePicker<T extends string>({ label, value, options, onChange, hint, className = '', strong = false, grid = false }: Props<T>) {
  const id = useId()
  const hintId = useId()
  return (
    <div className={className}>
      <p id={id} className={strong ? 'mb-1.5 font-medium' : 'mb-1.5 text-[0.875rem] font-medium text-ink-muted'}>{label}</p>
      <RadioGroup
        aria-labelledby={id}
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onValueChange={(v) => onChange(v as T)}
        className={`${grid ? 'grid grid-cols-2 sm:flex sm:flex-wrap' : 'flex flex-wrap'} gap-1 rounded-[10px] border border-line bg-bg p-1`}
      >
        {options.map((o) => (
          <Radio.Root
            key={o.id}
            value={o.id}
            className="press inline-flex min-h-10 flex-auto items-center justify-center rounded-[8px] px-3.5 text-[0.9375rem] text-ink-muted hover:text-ink data-[checked]:bg-surface data-[checked]:font-medium data-[checked]:text-ink data-[checked]:shadow-[0_0_0_1px_var(--line)]"
          >
            {o.label}
          </Radio.Root>
        ))}
      </RadioGroup>
      {hint && <p id={hintId} className="mt-1.5 text-[0.875rem] text-ink-muted">{hint}</p>}
    </div>
  )
}
