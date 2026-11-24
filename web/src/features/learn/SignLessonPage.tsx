import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { LetterGlyph } from '@/components/tool/LetterGlyph'
import { Button } from '@/components/ui/Button'
import { SIGN_LANGS, signLang } from '@/lib/signLangs'
import type { SignLang } from '@/stores/prefs'
import { loadFingerspelling, loadPhrases, type Fingerspelling, type PhraseSetT, type LetterItem } from '@/engines/sign/content'
import { SignSequence } from '@/features/text-to-sign/SignSequence'
import { LessonTabs } from './LessonTabs'
import { Practice } from './Practice'
import { ScriptPicker, useIndicScripts } from './IndicScripts'

function Card({ item, lang, script }: { item: LetterItem; lang: SignLang; script?: { map: Record<string, string>; lang: string; font?: string } | null }) {
  const label = item.letter ?? item.value ?? ''
  return (
    <li className="flex flex-col items-center gap-2 rounded-[12px] border border-line bg-surface p-3 text-center">
      {item.media ? <LetterGlyph media={item.media} className="h-24 w-24" alt={`${signLang(lang).code} ${label}`} /> : <span className="flex h-24 items-center text-ink-muted">Picture coming</span>}
      <span className="text-2xl font-semibold">{label}</span>
      {script && item.letter && script.map[item.letter] && (
        <span className="text-xl" lang={script.lang} style={{ fontFamily: script.font }} title={script.lang}>{script.map[item.letter]}</span>
      )}
      {item.motion && <span className="text-[0.8125rem] text-ink-muted">Moving letter</span>}
      {item.tip && <span className="text-[0.8125rem] text-ink-muted">{item.tip}</span>}
    </li>
  )
}

export default function SignLessonPage() {
  const { lang: raw = 'isl', section = 'alphabet' } = useParams()
  const lang = (SIGN_LANGS.some((l) => l.id === raw) ? raw : 'isl') as SignLang
  const info = signLang(lang)
  const [fs, setFs] = useState<Fingerspelling | null>(null)
  const [ph, setPh] = useState<PhraseSetT | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const scripts = useIndicScripts(lang === 'isl')
  useEffect(() => { setFs(null); void loadFingerspelling(lang).then(setFs); setPh(null); void loadPhrases(lang).then(setPh) }, [lang])
  const canPractice = lang === 'asl' || lang === 'isl'
  const tabs = [{ id: 'alphabet', label: 'Alphabet' }, { id: 'numbers', label: 'Numbers' }, { id: 'phrases', label: 'Phrases' }, ...(canPractice ? [{ id: 'practice', label: 'Practice with camera' }] : [])]

  return (
    <ToolFrame title={`Learn ${info.name}`} purpose={info.recognition ? 'Learn the letters, numbers and everyday phrases, then practise fingerspelling with your camera.' : 'Learn the letters, numbers and everyday phrases.'} privacy={{ where: 'device', detail: 'Camera practice stays on this device' }}>
      <nav aria-label="Sign language" className="mb-4 flex flex-wrap gap-2">
        {SIGN_LANGS.map((l) => (
          <Link key={l.id} to={`/learn/sign/${l.id}/${section === 'practice' && !l.recognition ? 'alphabet' : section}`} aria-current={l.id === lang ? 'page' : undefined}
            className={`press inline-flex min-h-11 items-center rounded-[8px] border px-3.5 no-underline ${l.id === lang ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink hover:border-line-strong'}`}>{l.code}</Link>
        ))}
      </nav>
      <LessonTabs base={`/learn/sign/${lang}`} tabs={tabs} />
      {!fs && section !== 'phrases' && <p className="text-ink-muted" role="status">Loading…</p>}
      {fs && section === 'alphabet' && (
        <div className="flex flex-col gap-4">
          {lang === 'isl' && scripts.data && <ScriptPicker state={scripts} />}
          {fs.chart && <img src={fs.chart} alt={`${info.name} alphabet chart`} className="w-full max-w-[720px] rounded-[12px] border border-line" loading="lazy" />}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {fs.letters.map((l) => <Card key={l.letter} item={l} lang={lang} script={lang === 'isl' ? scripts.current : null} />)}
          </ul>
          <p className="text-[0.9375rem] text-ink-muted">{fs.handed === 'two' ? 'ISL letters use both hands. Pictures show the hands as you see them when facing the signer.' : 'Pictures show the hand as you see it when facing the signer.'}</p>
        </div>
      )}
      {fs && section === 'numbers' && (
        fs.numbers.length
          ? <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">{fs.numbers.map((n) => <Card key={n.value} item={n} lang={lang} />)}</ul>
          : <p className="text-ink-muted">Number pictures for {info.code} are not available yet. Use Text to sign to see them animated.</p>
      )}
      {section === 'phrases' && (
        ph ? (
          <ul className="divide-y divide-line rounded-[12px] border border-line bg-surface">
            {ph.phrases.map((p, i) => (
              <li key={i} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium" lang={ph.spoken}>{p.text}</p>
                    {p.en !== p.text && <p className="text-ink-muted">{p.en}</p>}
                  </div>
                  <Button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{open === i ? 'Hide sign' : 'Show sign'}</Button>
                </div>
                {open === i && <div className="mt-3"><SignSequence text={p.media ? p.text : p.en} lang={lang} compact={false} /></div>}
              </li>
            ))}
          </ul>
        ) : <p className="text-ink-muted" role="status">Loading phrases…</p>
      )}
      {fs && section === 'practice' && canPractice && <Practice lang={lang as 'asl' | 'isl'} letters={fs.letters} />}
    </ToolFrame>
  )
}
