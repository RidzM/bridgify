import { useMemo, useState, useId } from 'react'
import { Volume2, Square } from 'lucide-react'
import { translateGrade1 } from '@/engines/braille/grade1'
import { toCells, describeCell } from '@/engines/braille/cells'
import { BrailleCell } from '@/components/shell/BrailleCell'
import { Button } from '@/components/ui/Button'

const EXAMPLES = ['Where is the hospital?', 'I need water', 'Please speak slowly', 'Thank you']

export function EveryWayDemo() {
  const [text, setText] = useState('Where is the hospital?')
  const [speaking, setSpeaking] = useState(false)
  const [word, setWord] = useState(-1)
  const inputId = useId()
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text])
  const braille = useMemo(() => toCells(translateGrade1(text.slice(0, 120)).unicode), [text])

  const speak = () => {
    const synth = window.speechSynthesis
    if (!synth) return
    if (speaking) { synth.cancel(); setSpeaking(false); setWord(-1); return }
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    let idx = -1
    u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) setWord(++idx) }
    u.onend = u.onerror = () => { setSpeaking(false); setWord(-1) }
    setSpeaking(true)
    synth.speak(u)
  }

  return (
    <section aria-labelledby="every-way" className="rounded-[var(--radius-panel)] border border-line bg-surface">
      <div className="border-b border-line p-4 md:p-6">
        <label htmlFor={inputId} id="every-way" className="mb-2 block text-lg font-bold">Type something to say</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            className="min-h-14 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-bg px-4 text-xl text-ink"
            autoComplete="off"
          />
          <Button variant={speaking ? 'live' : 'primary'} size="lg" onClick={speak} disabled={!text.trim()} icon={speaking ? <Square aria-hidden size={20} /> : <Volume2 aria-hidden size={20} />}>
            {speaking ? 'Stop' : 'Speak'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setText(e)} className="min-h-11 rounded-full border border-line px-3 text-sm text-ink-muted hover:border-line-strong hover:text-ink">
              {e}
            </button>
          ))}
        </div>
      </div>
      <dl className="divide-y divide-line">
        <div className="grid gap-2 p-4 md:grid-cols-[9rem_1fr] md:p-6">
          <dt className="font-bold text-ink-muted">Spoken</dt>
          <dd className="text-xl" aria-live="off">
            {words.map((w, i) => (
              <span key={i} className={i === word ? 'rounded bg-live-fill px-0.5 text-white' : ''}>{w} </span>
            ))}
          </dd>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-[9rem_1fr] md:p-6">
          <dt className="font-bold text-ink-muted">Braille</dt>
          <dd>
            <div key={text} className="raise flex flex-wrap gap-x-0.5 gap-y-2" role="img" aria-label={`Braille: ${braille.map((c) => c.char).join('')}`}>
              {braille.map((c, i) => (c.char === ' ' || c.char === '\u2800' ? <span key={i} className="w-3" /> : <BrailleCell key={i} dots={c.dots} size={30} raiseIndex={i} />))}
            </div>
            <p className="sr-only">{braille.map(describeCell).join(', ')}</p>
          </dd>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-[9rem_1fr] md:p-6">
          <dt className="font-bold text-ink-muted">Large print</dt>
          <dd className="break-words font-display text-[clamp(1.75rem,1rem+3vw,3rem)] font-bold uppercase leading-tight">{text || ' '}</dd>
        </div>
      </dl>
    </section>
  )
}
