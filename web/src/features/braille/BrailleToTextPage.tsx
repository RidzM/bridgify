import { useEffect, useRef, useState } from 'react'
import { Delete, Space, Volume2, Copy, Trash2, Plus } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/tool/Field'
import { Segmented } from '@/components/tool/Segmented'
import { BrailleCell } from '@/components/shell/BrailleCell'
import { toast } from '@/components/ui/Toast'
import { fromBraille, type Table } from '@/engines/braille/client'
import { dotsToChar } from '@/engines/braille/cells'
import { PerkinsChord } from '@/engines/braille/perkins'
import { Speaker } from '@/engines/speech/tts'

const speaker = new Speaker()
const BLANK = '⠀'
const LAYOUT: { dot: number; key: string }[] = [
  { dot: 3, key: 'S' }, { dot: 2, key: 'D' }, { dot: 1, key: 'F' }, { dot: 4, key: 'J' }, { dot: 5, key: 'K' }, { dot: 6, key: 'L' },
]

export default function BrailleToTextPage() {
  const [table, setTable] = useState<Table>('en-ueb-g1')
  const [cells, setCells] = useState<string[]>([])
  const [pending, setPending] = useState<number[]>([])
  const [tapDots, setTapDots] = useState<number[]>([])
  const [text, setText] = useState('')
  const chord = useRef(new PerkinsChord())
  const padRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      const unicode = cells.join('')
      if (!unicode.replace(/⠀/g, '').trim()) { setText(''); return }
      void fromBraille(unicode, table).then((r) => { if (live) setText(r.unicode) })
    }, 150)
    return () => { live = false; clearTimeout(t) }
  }, [cells, table])

  const add = (dots: number[]) => setCells((c) => [...c, dotsToChar(dots)])
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) setCells((c) => [...c, BLANK]); return }
    if (e.code === 'Backspace') { e.preventDefault(); setCells((c) => c.slice(0, -1)); return }
    if (chord.current.keyDown(e.code, e.repeat)) { e.preventDefault(); setPending(chord.current.pending) }
  }
  const onKeyUp = (e: React.KeyboardEvent) => {
    const cell = chord.current.keyUp(e.code)
    if (cell) { add(cell); setPending([]) }
  }

  return (
    <ToolFrame title="Braille to text" purpose="Write braille with six keys, like a Perkins brailler, and read it as text." privacy={{ where: 'device', detail: 'Translated on this device' }}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Panel label="Brailler" className="flex flex-col gap-5 p-5">
          <Segmented label="Braille" value={table} options={[{ id: 'en-ueb-g1', label: 'Grade 1' }, { id: 'en-ueb-g2', label: 'Grade 2' }]} onChange={setTable} />
          <div
            ref={padRef}
            tabIndex={0}
            role="application"
            aria-label="Braille keyboard. Press S D F J K L together for one cell, Space for a space, Backspace to delete."
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={() => { chord.current.reset(); setPending([]) }}
            className="rounded-[12px] bg-bg p-5 outline-none ring-brand focus-visible:ring-2 pointer-coarse:hidden"
          >
            <p className="mb-4 text-[0.9375rem] text-ink-muted">Click here, then press keys together. Release them all to write the cell.</p>
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {LAYOUT.map(({ dot, key }) => (
                <div key={key} className={`flex flex-col items-center rounded-[8px] border py-3 ${pending.includes(dot) ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface'}`}>
                  <span className="text-lg font-semibold">{key}</span>
                  <span className="text-[0.75rem] opacity-80">dot {dot}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[0.875rem] font-medium text-ink-muted"><span className="pointer-coarse:hidden">Or tap the dots</span><span className="hidden pointer-coarse:inline">Tap the dots for one cell, then Add cell</span></p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="grid grid-flow-col grid-cols-2 grid-rows-3 gap-2" role="group" aria-label="Dots for the next cell">
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <button key={d} type="button" aria-pressed={tapDots.includes(d)} aria-label={`Dot ${d}`}
                    onClick={() => setTapDots((t) => (t.includes(d) ? t.filter((x) => x !== d) : [...t, d]))}
                    className={`press h-12 w-12 rounded-full border-2 text-[0.8125rem] font-medium ${tapDots.includes(d) ? 'border-ok bg-ok text-white' : 'border-line-strong bg-surface text-ink-muted'}`}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={() => { if (tapDots.length) { add(tapDots); setTapDots([]) } }} disabled={!tapDots.length} icon={<Plus aria-hidden size={16} />}>Add cell</Button>
                <div className="flex gap-2">
                  <Button onClick={() => setCells((c) => [...c, BLANK])} icon={<Space aria-hidden size={16} />}>Space</Button>
                  <Button onClick={() => setCells((c) => c.slice(0, -1))} disabled={!cells.length} aria-label="Delete last cell" icon={<Delete aria-hidden size={16} />} />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel label="Result" className="flex flex-col gap-5 p-5">
          <div>
            <p className="mb-2 text-[0.875rem] font-medium text-ink-muted">Cells</p>
            <div className="flex min-h-12 flex-wrap gap-1.5" aria-live="polite" aria-label={`${cells.length} cells written`}>
              {cells.length ? cells.map((c, i) => (c === BLANK ? <span key={i} className="w-3" /> : <BrailleCell key={i} dots={[...Array(6)].map((_, k) => k + 1).filter((d) => ((c.codePointAt(0)! - 0x2800) >> (d - 1)) & 1)} size={26} />)) : <span className="text-ink-muted">Nothing written yet.</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[0.875rem] font-medium text-ink-muted">Text</p>
            <p aria-live="polite" className="max-w-none text-[1.75rem] font-medium leading-snug">{text || <span className="text-[1rem] font-normal text-ink-muted">The text appears here.</span>}</p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={() => speaker.speak(text, { lang: 'en-IN' })} disabled={!text} icon={<Volume2 aria-hidden size={16} />}>Speak</Button>
            <Button onClick={async () => { await navigator.clipboard.writeText(text); toast('Text copied') }} disabled={!text} icon={<Copy aria-hidden size={16} />}>Copy</Button>
            <Button variant="quiet" onClick={() => { const before = cells; setCells([]); toast('Cleared', { label: 'Undo', run: () => setCells(before) }) }} disabled={!cells.length} icon={<Trash2 aria-hidden size={16} />}>Clear</Button>
          </div>
        </Panel>
      </div>
    </ToolFrame>
  )
}
