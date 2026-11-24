import { useEffect, useState } from 'react'
import { AboutLayout } from './AboutLayout'

interface Credit { id: string; name: string; license?: string; author?: string; url?: string; usedFor?: string }
const files = import.meta.glob<{ items: Credit[] }>(['@content/CREDITS.json', '@content/credits/*.json'], { import: 'default' })

export default function CreditsPage() {
  const [items, setItems] = useState<Credit[]>([])
  useEffect(() => {
    void Promise.all(Object.values(files).map((f) => f())).then((all) => {
      const seen = new Set<string>()
      setItems(all.flatMap((a) => a.items).filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true))))
    })
  }, [])
  return (
    <AboutLayout title="Credits" intro="Bridgify is built on open data, models, fonts and media. Thank you to everyone below.">
      <ul className="!list-none !pl-0">
        {items.map((c) => (
          <li key={c.id} className="!mt-0 border-b border-line py-3">
            <p className="!mt-0 font-medium">{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name}</p>
            <p className="!mt-0.5 text-[0.9375rem] text-ink-muted">{[c.author, c.license, c.usedFor].filter(Boolean).join(', ')}</p>
          </li>
        ))}
      </ul>
      <p className="text-[0.9375rem] text-ink-muted">liblouis is LGPL-2.1: the exact source used is listed in /wasm/liblouis/SOURCE.md.</p>
    </AboutLayout>
  )
}
