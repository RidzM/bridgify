import { useEffect, useState } from 'react'

interface Lang { lang: string; script: string; fontsource?: string; map: Record<string, string> }
interface Data { letters: string; languages: Lang[] }
const files = import.meta.glob<Data>('@content/scripts/indic-22.json', { import: 'default' })
// One font package per script, loaded only when that script is chosen.
const fonts = import.meta.glob('/node_modules/@fontsource/noto-sans-*/400.css')

export interface ScriptState { data: Data | null; index: number; setIndex: (i: number) => void; current: { map: Record<string, string>; lang: string; font?: string } | null }

export function useIndicScripts(enabled: boolean): ScriptState {
  const [data, setData] = useState<Data | null>(null)
  const [index, setIndex] = useState(0)
  useEffect(() => { const f = Object.values(files)[0]; if (enabled && f) void f().then(setData) }, [enabled])
  const cur = data?.languages[index] ?? null
  useEffect(() => {
    if (!cur?.fontsource) return
    const key = Object.keys(fonts).find((k) => k.includes(`${cur.fontsource}/400.css`))
    if (key) void fonts[key]!()
  }, [cur])
  const family = cur?.fontsource ? `'${cur.fontsource.replace('@fontsource/', '').split('-').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')}', sans-serif` : undefined
  return { data, index, setIndex, current: cur ? { map: cur.map, lang: cur.lang, font: family } : null }
}

export function ScriptPicker({ state }: { state: ScriptState }) {
  if (!state.data) return null
  return (
    <label className="flex flex-wrap items-center gap-2">
      <span className="text-[0.9375rem] text-ink-muted">Show each letter in</span>
      <select value={state.index} onChange={(e) => state.setIndex(Number(e.target.value))} className="min-h-11 rounded-[8px] border border-line bg-surface px-3 text-ink">
        {state.data.languages.map((l, i) => <option key={l.lang} value={i}>{l.lang} ({l.script})</option>)}
      </select>
      <span className="text-[0.8125rem] text-ink-muted">22 languages of India</span>
    </label>
  )
}
