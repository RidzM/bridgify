import { Slider as BaseSlider } from '@base-ui/react/slider'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  minLabel?: string
  maxLabel?: string
}

export function Slider({ label, value, min, max, step, onChange, format = String, minLabel, maxLabel }: Props) {
  return (
    <BaseSlider.Root value={value} min={min} max={max} step={step} onValueChange={(v) => onChange(v as number)} className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <BaseSlider.Label className="font-medium">{label}</BaseSlider.Label>
        <span className="text-ink-muted" aria-hidden>{format(value)}</span>
      </div>
      <BaseSlider.Control className="flex h-11 w-full touch-none items-center">
        <BaseSlider.Track className="h-2 w-full rounded-full bg-surface-2 outline outline-1 outline-line-strong">
          <BaseSlider.Indicator className="rounded-full bg-brand" />
          <BaseSlider.Thumb
            aria-label={label}
            getAriaValueText={(_f, v) => format(v)}
            className="h-6 w-6 rounded-full border-2 border-brand bg-surface focus-visible:outline-3 focus-visible:outline-[var(--focus)]"
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
      {(minLabel || maxLabel) && (
        <div className="mt-1 flex justify-between text-sm text-ink-muted" aria-hidden>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </BaseSlider.Root>
  )
}
