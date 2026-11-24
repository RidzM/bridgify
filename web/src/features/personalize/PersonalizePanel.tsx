import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { Sheet } from '@/components/ui/Sheet'
import { Slider } from '@/components/ui/Slider'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { MODES, MODE_SWATCH, type Mode } from '@/lib/modes'
import { TOOLS } from '@/lib/tools'
import { usePrefs, type Prefs } from '@/stores/prefs'

export function PersonalizePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const p = usePrefs()

  const change = <K extends keyof Prefs>(key: K, value: Prefs[K], label: string) => {
    const before = usePrefs.getState()[key]
    p.set(key, value)
    toast(label, { label: 'Undo', run: () => usePrefs.getState().set(key, before) })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left" title="Personalize" description="Changes apply everywhere straight away and are saved on this device.">
      <section aria-labelledby="pz-mode">
        <h2 id="pz-mode" className="mb-3 text-lg">Display mode</h2>
        <RadioGroup
          value={p.mode}
          onValueChange={(v) => change('mode', v as Mode, `${MODES.find((m) => m.id === v)?.label} mode on`)}
          aria-labelledby="pz-mode"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {MODES.map((m) => {
            const [bg, ink, brand] = MODE_SWATCH[m.id]
            return (
              <Radio.Root
                key={m.id}
                value={m.id}
                className="group flex min-h-11 flex-col items-start gap-1.5 rounded-[var(--radius-control)] border border-line-strong bg-surface p-2.5 text-left data-[checked]:border-2 data-[checked]:border-brand"
              >
                <span className="flex h-7 w-full items-center gap-1.5 rounded-[4px] border border-line px-1.5" style={{ background: bg }} aria-hidden>
                  <span className="text-[0.8rem] font-bold" style={{ color: ink, fontFamily: m.id === 'dyslexia' ? 'OpenDyslexic' : undefined }}>Aa</span>
                  <span className="ml-auto h-3 w-3 rounded-full" style={{ background: brand }} />
                </span>
                <span className="text-[0.95rem] leading-tight">{m.label}</span>
                <Radio.Indicator className="sr-only">selected</Radio.Indicator>
              </Radio.Root>
            )
          })}
        </RadioGroup>
        <p className="mt-2 text-sm text-ink-muted">{MODES.find((m) => m.id === p.mode)?.note}</p>
      </section>

      <section className="mt-7" aria-labelledby="pz-text">
        <h2 id="pz-text" className="sr-only">Text size</h2>
        <Slider
          label="Text size"
          value={Math.round(p.textScale * 100)}
          min={80}
          max={200}
          step={10}
          onChange={(v) => p.set('textScale', v / 100)}
          format={(v) => `${v}%`}
          minLabel="Smaller"
          maxLabel="Larger"
        />
      </section>

      <section className="mt-7" aria-labelledby="pz-tools">
        <h2 id="pz-tools" className="mb-1 text-lg">Show or hide tools</h2>
        <p className="mb-2 text-sm text-ink-muted">Hidden tools disappear from the home page and menus.</p>
        {TOOLS.map((t) => (
          <Switch key={t.id} label={t.name} checked={!p.hiddenTools.includes(t.id)} onChange={() => p.toggleTool(t.id)} />
        ))}
      </section>

      <section className="mt-7" aria-labelledby="pz-more">
        <h2 id="pz-more" className="mb-1 text-lg">More</h2>
        <Switch label="Underline all links" checked={p.underlineLinks} onChange={(v) => p.set('underlineLinks', v)} />
        <Switch label="Large cursor" checked={p.largeCursor} onChange={(v) => p.set('largeCursor', v)} />
        <Switch
          label="Turn off animation"
          hint="Calm, Focus and Autism-friendly modes already do this."
          checked={p.motion === 'off'}
          onChange={(v) => p.set('motion', v ? 'off' : 'system')}
        />
      </section>

      <div className="mt-8 border-t border-line pt-5">
        <Button
          variant="quiet"
          onClick={() => {
            const before = { ...usePrefs.getState() }
            p.reset()
            toast('Settings reset', { label: 'Undo', run: () => usePrefs.setState(before) })
          }}
        >
          Reset to defaults
        </Button>
      </div>
    </Sheet>
  )
}
