import { useMemo, useState, useId, useRef } from 'react'
import { Volume2, Square } from 'lucide-react'
import { translateGrade1 } from '@/engines/braille/grade1'
import { toCells, describeCell } from '@/engines/braille/cells'
import { BrailleCell } from '@/components/shell/BrailleCell'

const PHRASES = ['I need water', 'Please speak slowly', 'Can you write it down?', 'I need a doctor']

/** One message, shown as speech, braille and large print at once. */
export function Composer() {
  const [text, setText] = useState('Where is the hospital?')
  const [speaking, setSpeaking] = useState(false)
  const [word, setWord] = useState(-1)
  const inputId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text])
  const braille = useMemo(() => toCells(translateGrade1(text.slice(0, 140)).unicode), [text])

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
    <section aria-label="Say something" className="grid overflow-hidden rounded-[16px] border border-line bg-surface lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4 border-line p-5 md:p-6 lg:border-r">
        <label htmlFor={inputId} className="font-medium">What do you want to say?</label>
        <textarea
          ref={inputRef}
          id={inputId}
          value={text}
          maxLength={140}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          className="min-h-28 w-full resize-none rounded-[10px] border border-line bg-bg px-4 py-3 text-[1.375rem] leading-snug text-ink outline-none transition-[border-color] duration-150 focus:border-brand"
        />
        <div className="flex flex-wrap gap-2">
          {PHRASES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setText(p); inputRef.current?.focus() }}
              className="press min-h-10 rounded-[8px] border border-line px-3 text-[0.875rem] text-ink-muted hover:border-line-strong hover:text-ink"
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={speak}
          disabled={!text.trim()}
          className={`press mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-5 font-medium disabled:opacity-50 ${speaking ? 'bg-live-fill text-white' : 'bg-brand text-brand-ink hover:opacity-90'}`}
        >
          {speaking ? <Square aria-hidden size={18} /> : <Volume2 aria-hidden size={18} />}
          {speaking ? 'Stop' : 'Speak it'}
        </button>
      </div>

      <dl className="flex flex-col bg-bg/60">
        <div className="px-5 py-5 md:px-7">
          <dt className="mb-2 text-[0.8125rem] font-medium text-ink-muted">Spoken</dt>
          <dd className="text-[1.25rem] leading-relaxed">
            {words.length ? words.map((w, i) => (
              <span key={i} className={`rounded-[4px] transition-colors duration-100 ${i === word ? 'bg-live-fill text-white' : ''}`}>{w}{' '}</span>
            )) : <span className="text-ink-muted">Type a message to hear it</span>}
          </dd>
        </div>
        <div className="border-t border-line px-5 py-5 md:px-7">
          <dt className="mb-3 text-[0.8125rem] font-medium text-ink-muted">Braille, grade 1</dt>
          <dd>
            <div key={text} className="raise flex flex-wrap gap-x-1 gap-y-3" role="img" aria-label={`Braille cells for: ${text}`}>
              {braille.map((c, i) =>
                c.char === ' ' || c.char === '⠀' ? <span key={i} className="w-3" /> : <BrailleCell key={i} dots={c.dots} size={26} raiseIndex={i} />,
              )}
            </div>
            <p className="sr-only">{braille.map(describeCell).join(', ')}</p>
          </dd>
        </div>
        <div className="flex-1 border-t border-line px-5 py-5 md:px-7">
          <dt className="mb-1 text-[0.8125rem] font-medium text-ink-muted">Large print</dt>
          <dd className="break-words text-[clamp(1.75rem,1.1rem+2.4vw,2.75rem)] font-semibold uppercase leading-[1.1] tracking-[-0.01em]">
            {text || ' '}
          </dd>
        </div>
      </dl>
    </section>
  )
}
