import { Tabs } from '@base-ui/react/tabs'
import { useState } from 'react'

export interface PhraseSet { lang: string; categories: { id: string; label: string; items: (string | { text: string; en?: string })[] }[] }

interface Props {
  set: PhraseSet
  onPick: (text: string) => void
  title?: string
}

/** Phrases grouped by situation; one tap uses the phrase straight away. */
export function QuickAccess({ set, onPick, title = 'Quick phrases' }: Props) {
  const [tab, setTab] = useState(set.categories[0]?.id ?? '')
  return (
    <section aria-labelledby="qa-title" className="rounded-[16px] border border-line bg-surface p-4 md:p-5">
      <h2 id="qa-title" className="mb-3 text-base">{title}</h2>
      <Tabs.Root value={tab} onValueChange={(v) => setTab(String(v))}>
        <Tabs.List className="mb-4 flex gap-1 overflow-x-auto pb-1" aria-label="Phrase groups">
          {set.categories.map((c) => (
            <Tabs.Tab
              key={c.id}
              value={c.id}
              className="press min-h-10 shrink-0 whitespace-nowrap rounded-[8px] px-3 text-[0.9375rem] text-ink-muted hover:bg-surface-2 hover:text-ink data-[active]:bg-ink data-[active]:text-surface"
            >
              {c.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {set.categories.map((c) => (
          <Tabs.Panel key={c.id} value={c.id} className="flex flex-wrap gap-2" lang={set.lang}>
            {c.items.map((item) => {
              const text = typeof item === 'string' ? item : item.text
              const en = typeof item === 'string' ? undefined : item.en
              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => onPick(text)}
                  className="press min-h-11 rounded-[8px] border border-line bg-bg px-3.5 text-left text-[0.9375rem] text-ink hover:border-line-strong"
                >
                  {text}
                  {en && <span className="ml-1.5 text-ink-muted" lang="en">({en})</span>}
                </button>
              )
            })}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </section>
  )
}
