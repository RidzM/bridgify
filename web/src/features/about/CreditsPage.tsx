import { useEffect, useState } from 'react'
import { AboutLayout } from './AboutLayout'

interface Credit { id: string; name: string; license?: string; author?: string; url?: string; usedFor?: string }
type CreditFile = { items?: Credit[] } | Credit[]
const files = import.meta.glob<CreditFile>(['@content/CREDITS.json', '@content/credits/*.json'], { import: 'default' })

/** Section heading for each credits file; unknown files share the last group. */
const GROUPS: [test: RegExp, title: string][] = [
  [/CREDITS\.json$/, 'Software, models and data'],
  [/credits\/signs\.json$/, 'Sign videos and animations'],
  [/credits\/letters\.json$/, 'Alphabet and number pictures'],
  [/./, 'Other media'],
]

interface Group { title: string; items: Credit[] }

const isCredit = (c: unknown): c is Credit =>
  !!c && typeof c === 'object' && typeof (c as Credit).id === 'string' && typeof (c as Credit).name === 'string'

export default function CreditsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  useEffect(() => {
    const entries = Object.entries(files)
    void Promise.all(entries.map(([, load]) => load())).then((all) => {
      const seen = new Set<string>()
      const out = GROUPS.map(([, title]) => ({ title, items: [] as Credit[] }))
      all.forEach((file, i) => {
        const path = entries[i]![0]
        const g = GROUPS.findIndex(([test]) => test.test(path))
        const list = Array.isArray(file) ? file : (file.items ?? [])
        for (const c of list) if (isCredit(c) && !seen.has(c.id)) { seen.add(c.id); out[g]!.items.push(c) }
      })
      setGroups(out.filter((g) => g.items.length))
    })
  }, [])
  return (
    <AboutLayout title="Credits" intro="Bridgify is built on open data, models, fonts and media. Thank you to everyone below.">
      {groups.map((g) => (
        <section key={g.title} aria-labelledby={`credits-${g.title.replace(/\W+/g, '-')}`}>
          <h2 id={`credits-${g.title.replace(/\W+/g, '-')}`}>{g.title}</h2>
          <ul className="!list-none !pl-0">
            {g.items.map((c) => (
              <li key={c.id} className="!mt-0 border-b border-line py-3">
                <p className="!mt-0 font-medium">{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</p>
                <p className="!mt-0.5 text-[0.9375rem] text-ink-muted">{[c.author, c.license, c.usedFor].filter(Boolean).join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-[0.9375rem] text-ink-muted">liblouis is LGPL-2.1: the exact source used is listed in /wasm/liblouis/SOURCE.md.</p>
    </AboutLayout>
  )
}
