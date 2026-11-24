import { useEffect, useId, useState } from 'react'
import { Hand, Volume2 } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { QuickAccess, type PhraseSet } from '@/components/tool/QuickAccess'
import { planSigns, type SignPlan } from '@/engines/sign/sequence'
import { Speaker } from '@/engines/speech/tts'
import { SIGN_LANGS, signLang } from '@/lib/signLangs'
import { usePrefs, type SignLang } from '@/stores/prefs'
import { SignPlayer } from './SignPlayer'

const speaker = new Speaker()
const quick = import.meta.glob<PhraseSet>('@content/phrases/quick-access.*.json', { import: 'default' })
const QUICK_FOR: Record<SignLang, string> = { asl: 'en', isl: 'hi', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }
const EXAMPLE: Record<SignLang, string> = { asl: 'hello', isl: 'namaste', lsf: 'au revoir', lsm: 'amigo', lis: 'scusa', dgs: 'wasser' }

async function loadQuick(lang: SignLang): Promise<PhraseSet | null> {
  const want = QUICK_FOR[lang]
  const key = Object.keys(quick).find((k) => k.endsWith(`quick-access.${want}.json`)) ?? Object.keys(quick).find((k) => k.endsWith('quick-access.en.json'))
  return key ? quick[key]!() : null
}

export default function TextToSignPage() {
  const pref = usePrefs((s) => s.sign)
  const setPref = usePrefs((s) => s.set)
  const lang = pref.lang
  const info = signLang(lang)
  const [text, setText] = useState(EXAMPLE[lang])
  const [plan, setPlan] = useState<SignPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qa, setQa] = useState<PhraseSet | null>(null)
  const inputId = useId()

  useEffect(() => { void loadQuick(lang).then(setQa) }, [lang])

  const show = async (t = text) => {
    if (!t.trim()) return
    setBusy(true); setError(null)
    try { setPlan(await planSigns(t, lang)) }
    catch { setError("Signs couldn't load. Check your connection and try again.") }
    finally { setBusy(false) }
  }
  useEffect(() => { setText(EXAMPLE[lang]); setPlan(null) }, [lang])

  return (
    <ToolFrame title="Text to sign" purpose="Type words and see them signed. Unknown words are fingerspelled letter by letter." privacy={{ where: 'device', detail: 'Animations load from Bridgify; new words from the free sign.mt service' }}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Sign language">
        {SIGN_LANGS.map((l) => (
          <Chip key={l.id} selected={lang === l.id} onClick={() => setPref('sign', { lang: l.id })} title={l.name}>{l.code}</Chip>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Panel label="Words" className="flex flex-col gap-4 p-5">
          <p className="text-[0.9375rem] text-ink-muted">{info.name}. Type in {info.spoken === 'Hindi' ? 'English or Hindi' : `English or ${info.spoken}`}.</p>
          <div>
            <label htmlFor={inputId} className="mb-1.5 block font-medium">Text</label>
            <textarea id={inputId} value={text} rows={3} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void show() } }}
              className="w-full resize-y rounded-[10px] border border-line bg-bg px-4 py-3 text-[1.25rem] outline-none focus:border-brand" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={() => void show()} disabled={!text.trim() || busy} icon={<Hand aria-hidden size={18} />}>{busy ? 'Preparing signs…' : 'Show signs'}</Button>
            <Button size="lg" onClick={() => speaker.speak(text, { lang: info.speechLang })} disabled={!text.trim()} icon={<Volume2 aria-hidden size={18} />}>Speak</Button>
          </div>
          {plan?.gloss && <p className="text-[0.9375rem]"><span className="text-ink-muted">ISL word order (approximate): </span><span className="font-medium tracking-wide">{plan.gloss.join(' ')}</span></p>}
          {plan && plan.liveFailed.length > 0 && <p className="text-[0.9375rem] text-ink-muted">No sign found for {plan.liveFailed.map((w) => `"${w}"`).join(', ')}, so {plan.liveFailed.length > 1 ? 'they are' : 'it is'} fingerspelled.</p>}
          {error && <p role="alert">{error}</p>}
          <p className="mt-auto text-[0.8125rem] text-ink-muted">Word-by-word sign lookup. It is not a full translation and does not replace an interpreter.</p>
        </Panel>
        <Panel label="Signs" className="p-5">
          {plan ? <SignPlayer items={plan.items} label={`Signs for ${text}`} /> : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-center text-ink-muted">
              <Hand aria-hidden size={32} strokeWidth={1.5} />
              <p>{busy ? 'Preparing signs…' : 'Press Show signs to see them here.'}</p>
            </div>
          )}
        </Panel>
      </div>
      {qa && (
        <div className="mt-4">
          <QuickAccess set={qa} title={`Quick phrases (${info.spoken === 'Hindi' ? 'Hindi' : info.spoken})`} onPick={(t) => { setText(t); void show(t) }} />
        </div>
      )}
    </ToolFrame>
  )
}
