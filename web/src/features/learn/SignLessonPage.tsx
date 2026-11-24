import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { LetterGlyph } from '@/components/tool/LetterGlyph'
import { Button } from '@/components/ui/Button'
import { SIGN_LANGS, signLang } from '@/lib/signLangs'
import { usePrefs, type SignLang } from '@/stores/prefs'
import { loadFingerspelling, loadPhrases, type Fingerspelling, type PhraseSetT, type LetterItem } from '@/engines/sign/content'
import { SignSequence } from '@/features/text-to-sign/SignSequence'
import { LessonTabs } from './LessonTabs'
import { Practice } from './Practice'
import { ScriptPicker, useIndicScripts } from './IndicScripts'

function Card({ item, lang, script }: { item: LetterItem; lang: SignLang; script?: { map: Record<string, string>; lang: string; name: string; dir?: 'rtl'; font?: string } | null }) {
  const label = item.letter ?? item.value ?? ''
  return (
    <li className="flex flex-col items-center gap-2 rounded-[12px] border border-line bg-surface p-3 text-center">
      {item.media ? <LetterGlyph media={item.media} className="h-24 w-24" alt={`${signLang(lang).code} ${label}`} /> : <span className="flex h-24 items-center text-[0.875rem] text-ink-muted">No picture yet</span>}
      <span className="text-2xl font-semibold">{label}</span>
      {script && item.letter && script.map[item.letter] && (
        <span className="text-xl" lang={script.lang} dir={script.dir} style={{ fontFamily: script.font }} title={script.name}>{script.map[item.letter]}</span>
      )}
      {item.motion && <span className="text-[0.8125rem] text-ink-muted">Moving letter</span>}
      {item.tip && <span className="text-[0.8125rem] text-ink-muted">{item.tip}</span>}
    </li>
  )
}

/** Shown when no openly licensed pictures exist for a language: says why, and offers the animated signer instead. */
function NoPictures({ what, lang }: { what: string; lang: SignLang }) {
  const setPref = usePrefs((s) => s.set)
  return (
    <div className="flex max-w-[40em] flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-5">
      <p className="font-medium">There are no openly licensed pictures of the {what} signs yet.</p>
      <p className="text-ink-muted">Bridgify only shows pictures it has permission to share. The animated signer in Text to sign can fingerspell any word for you instead.</p>
      <Link to="/tools/text-to-sign" onClick={() => setPref('sign', { lang })} className="press inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 font-medium text-brand-ink no-underline hover:opacity-90">Open Text to sign</Link>
    </div>
  )
}

export default function SignLessonPage() {
  const { lang: raw = 'isl', section = 'alphabet' } = useParams()
  const lang = (SIGN_LANGS.some((l) => l.id === raw) ? raw : 'isl') as SignLang
  const info = signLang(lang)
  // undefined while loading; null when this language has no file yet.
  const [fs, setFs] = useState<Fingerspelling | null | undefined>(undefined)
  const [ph, setPh] = useState<PhraseSetT | null | undefined>(undefined)
  const [open, setOpen] = useState<number | null>(null)
  const scripts = useIndicScripts(lang === 'isl')
  useEffect(() => {
    setFs(undefined); void loadFingerspelling(lang).then(setFs, () => setFs(null))
    setPh(undefined); void loadPhrases(lang).then(setPh, () => setPh(null))
  }, [lang])
  const canPractice = lang === 'asl' || lang === 'isl'
  const tabs = [{ id: 'alphabet', label: 'Alphabet' }, { id: 'numbers', label: 'Numbers' }, { id: 'phrases', label: 'Phrases' }, ...(canPractice ? [{ id: 'practice', label: 'Practice with camera' }] : [])]

  return (
    <ToolFrame title={`Learn ${info.name}`} purpose={info.recognition ? 'Learn the letters, numbers and everyday phrases, then practise fingerspelling with your camera.' : 'Learn the letters, numbers and everyday phrases.'} privacy={{ where: 'device', detail: info.recognition ? 'Camera practice stays on this device' : 'Animations load from Bridgify; new words from the free sign.mt service' }}>
      <nav aria-label="Sign language" className="mb-4 flex flex-wrap gap-2">
        {SIGN_LANGS.map((l) => (
          <Link key={l.id} to={`/learn/sign/${l.id}/${section === 'practice' && !l.recognition ? 'alphabet' : section}`} aria-current={l.id === lang ? 'page' : undefined}
            className={`press inline-flex min-h-11 items-center rounded-[8px] border px-3.5 no-underline ${l.id === lang ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface text-ink hover:border-line-strong'}`}>{l.code}</Link>
        ))}
      </nav>
      <LessonTabs base={`/learn/sign/${lang}`} tabs={tabs} />
      {fs === undefined && section !== 'phrases' && <p className="text-ink-muted" role="status">Loading…</p>}
      {fs === null && section !== 'phrases' && <p className="text-ink-muted">The {info.name} alphabet isn't available yet. <Link to="/tools/text-to-sign">Text to sign</Link> can still fingerspell words for you.</p>}
      {fs && section === 'alphabet' && fs.letters.filter((l) => l.media).length < fs.letters.length / 2 && (
        <NoPictures what={`${info.name} alphabet`} lang={lang} />
      )}
      {fs && section === 'alphabet' && fs.letters.filter((l) => l.media).length >= fs.letters.length / 2 && (
        <div className="flex flex-col gap-4">
          {lang === 'isl' && scripts.data && <ScriptPicker state={scripts} />}
          {fs.chart && <img src={fs.chart} alt={`${info.name} alphabet chart`} className="w-full max-w-[720px] rounded-[12px] border border-line" loading="lazy" />}
          <ul aria-label={`${info.code} alphabet`} className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {fs.letters.map((l) => <Card key={l.letter} item={l} lang={lang} script={lang === 'isl' ? scripts.current : null} />)}
          </ul>
          <p className="text-[0.9375rem] text-ink-muted">{fs.handed === 'two' ? 'ISL letters use both hands. Pictures show the hands as you see them when facing the signer.' : 'Pictures show the hand as you see it when facing the signer.'}</p>
        </div>
      )}
      {fs && section === 'numbers' && (
        fs.numbers.some((n) => n.media)
          ? <ul aria-label={`${info.code} numbers`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">{fs.numbers.map((n) => <Card key={n.value} item={n} lang={lang} />)}</ul>
          : <NoPictures what={`${info.name} number`} lang={lang} />
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
                {open === i && <div className="mt-3"><SignSequence text={lang === 'isl' ? p.en : p.text} pose={p.media?.src} poseLabel={p.en} lang={lang} compact={false} /></div>}
              </li>
            ))}
          </ul>
        ) : ph === null
          ? <p className="text-ink-muted">Phrases for {info.code} aren't available yet. Try them in <Link to="/tools/text-to-sign">Text to sign</Link>.</p>
          : <p className="text-ink-muted" role="status">Loading phrases…</p>
      )}
      {fs && section === 'practice' && canPractice && <Practice lang={lang as 'asl' | 'isl'} letters={fs.letters} />}
    </ToolFrame>
  )
}
