import { Link } from 'react-router-dom'
import { TOOLS, type Tool } from '@/lib/tools'
import { LETTERS } from '@/engines/braille/grade1'
import { charToDots } from '@/engines/braille/cells'
import { BrailleCell } from '@/components/shell/BrailleCell'
import { usePrefs } from '@/stores/prefs'

function Row({ t }: { t: Tool }) {
  return (
    <li>
      <Link to={t.path} className="group grid grid-cols-[2.25rem_1fr] items-start gap-3 py-4 text-ink no-underline">
        <BrailleCell dots={charToDots(LETTERS[t.initial]!)} size={26} className="mt-0.5" />
        <span>
          <span className="block text-lg font-bold group-hover:text-brand group-hover:underline">{t.name}</span>
          <span className="mt-0.5 block text-ink-muted">{t.purpose}</span>
        </span>
      </Link>
    </li>
  )
}

export function ToolDirectory() {
  const hidden = usePrefs((s) => s.hiddenTools)
  const visible = TOOLS.filter((t) => !hidden.includes(t.id))
  const cols: { id: Tool['direction']; title: string; note: string }[] = [
    { id: 'say', title: 'Say it', note: 'From you, in a form others can take in.' },
    { id: 'understand', title: 'Understand it', note: 'From others, in a form you can take in.' },
  ]
  return (
    <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {cols.map((c) => {
        const items = visible.filter((t) => t.direction === c.id)
        if (!items.length) return null
        return (
          <section key={c.id} aria-labelledby={`dir-${c.id}`}>
            <h2 id={`dir-${c.id}`}>{c.title}</h2>
            <p className="mt-1 text-ink-muted">{c.note}</p>
            <ul className="mt-2 divide-y divide-line border-t border-line">{items.map((t) => <Row key={t.id} t={t} />)}</ul>
          </section>
        )
      })}
      {visible.length === 0 && <p>All tools are hidden. Open Personalize to show them again.</p>}
    </div>
  )
}
