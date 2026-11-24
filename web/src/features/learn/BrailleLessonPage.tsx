import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Volume2 } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { BrailleCell } from '@/components/shell/BrailleCell'
import { Button } from '@/components/ui/Button'
import { LETTERS, translateGrade1 } from '@/engines/braille/grade1'
import { charToDots, dotsToChar } from '@/engines/braille/cells'
import { Speaker } from '@/engines/speech/tts'
import { LessonTabs } from './LessonTabs'

const speaker = new Speaker()
const g2files = import.meta.glob<{ [k: string]: unknown }>('@content/tutorials/braille-g2.json', { import: 'default' })
interface G2Item { word: string; unicode: string; category?: string; example?: string }

function Cell({ unicode, label, sub }: { unicode: string; label: string; sub?: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-[12px] border border-line bg-surface p-3">
      <div className="flex gap-1" aria-hidden>{[...unicode].map((c, i) => <BrailleCell key={i} dots={charToDots(c)} size={30} />)}</div>
      <span className="text-lg font-semibold">{label}</span>
      {sub && <span className="text-[0.8125rem] text-ink-muted tabular">{sub}</span>}
      <span className="sr-only">{label}: {[...unicode].map((c) => `dots ${charToDots(c).join(' ')}`).join(', then ')}</span>
    </li>
  )
}

function Quiz() {
  const letters = Object.keys(LETTERS)
  const [target, setTarget] = useState(() => letters[Math.floor(Math.random() * letters.length)]!)
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)
  const options = useMemo(() => {
    const o = new Set([target]); while (o.size < 4) o.add(letters[Math.floor(Math.random() * letters.length)]!)
    return [...o].sort()
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section aria-labelledby="quiz" className="rounded-[16px] border border-line bg-surface p-5">
      <h2 id="quiz" className="text-base">Quick quiz: which letter is this?</h2>
      <div className="my-4 flex justify-center" aria-label={`dots ${charToDots(LETTERS[target]!).join(' ')}`} role="img"><BrailleCell dots={charToDots(LETTERS[target]!)} size={64} /></div>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((o) => (
          <Button key={o} variant={result && o === target ? 'primary' : 'secondary'} onClick={() => setResult(o === target ? 'right' : 'wrong')}>{o.toUpperCase()}</Button>
        ))}
      </div>
      <p aria-live="polite" className="mt-3 text-center">{result === 'right' ? 'Correct.' : result === 'wrong' ? `Not quite. It's ${target.toUpperCase()}.` : ''}</p>
      {result && <div className="mt-2 flex justify-center"><Button variant="quiet" onClick={() => { setTarget(letters[Math.floor(Math.random() * letters.length)]!); setResult(null) }}>Next letter</Button></div>}
    </section>
  )
}

export default function BrailleLessonPage() {
  const { section = 'alphabet' } = useParams()
  const [g2, setG2] = useState<G2Item[] | null>(null)
  useEffect(() => {
    const load = Object.values(g2files)[0]
    if (section === 'contractions' && load) void load().then((d) => {
      const all = Object.values(d).filter(Array.isArray).flat() as G2Item[]
      setG2(all.filter((x) => x && typeof x.word === 'string' && typeof x.unicode === 'string'))
    })
  }, [section])

  return (
    <ToolFrame title="Learn braille" purpose="Each braille cell has six dot positions. Raised dots are filled." privacy={{ where: 'device', detail: 'Works offline' }}>
      <LessonTabs base="/learn/braille" tabs={[{ id: 'alphabet', label: 'Alphabet (Grade 1)' }, { id: 'numbers', label: 'Numbers' }, { id: 'contractions', label: 'Grade 2 contractions' }]} />
      {section === 'alphabet' && (
        <div className="flex flex-col gap-6">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {Object.entries(LETTERS).map(([l, ch]) => <Cell key={l} unicode={ch} label={l.toUpperCase()} sub={`dots ${charToDots(ch).join('')}`} />)}
          </ul>
          <p className="text-ink-muted">Capital letters add the capital sign (dot 6) before the letter: <span className="font-medium text-ink">{translateGrade1('A').unicode}</span>.</p>
          <Quiz />
        </div>
      )}
      {section === 'numbers' && (
        <div className="flex flex-col gap-4">
          <p>Numbers use the number sign (dots 3 4 5 6) followed by the letters A to J.</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((n) => <Cell key={n} unicode={translateGrade1(n).unicode} label={n} sub={`# + ${'jabcdefghi'[Number(n)]!.toUpperCase()}`} />)}
          </ul>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cell unicode={dotsToChar([3, 4, 5, 6])} label="Number sign" sub="dots 3456" />
            <Cell unicode={dotsToChar([6])} label="Capital sign" sub="dot 6" />
          </ul>
        </div>
      )}
      {section === 'contractions' && (
        <div className="flex flex-col gap-4">
          <p>Grade 2 braille shortens common words and letter groups. Fluent readers use it everywhere.</p>
          {g2 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {g2.map((x) => <Cell key={`${x.word}-${x.unicode}`} unicode={x.unicode.replace(/⠀/g, '')} label={x.word} sub={x.example ? `as in ${x.example}` : x.category} />)}
            </ul>
          ) : <p className="text-ink-muted" role="status">Loading contractions…</p>}
        </div>
      )}
      <div className="mt-6"><Button variant="quiet" onClick={() => speaker.speak('Braille has six dots in two columns. Dots one, two and three are on the left, four, five and six on the right.')} icon={<Volume2 aria-hidden size={16} />}>Hear how braille cells work</Button></div>
    </ToolFrame>
  )
}
