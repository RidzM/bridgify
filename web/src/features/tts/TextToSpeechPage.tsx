import { useEffect, useMemo, useRef, useState, useId } from 'react'
import { Play, Pause, Square, RotateCcw } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Slider'
import { Select, Panel } from '@/components/tool/Field'
import { QuickAccess, type PhraseSet } from '@/components/tool/QuickAccess'
import { Speaker, levelToRate, type TtsState } from '@/engines/speech/tts'
import { getVoices, rankVoices } from '@/engines/speech/voices'
import { wordSpans } from '@/engines/speech/chunk'
import { usePrefs } from '@/stores/prefs'
import { toast } from '@/components/ui/Toast'
import en from '@content/phrases/quick-access.en.json'
import hi from '@content/phrases/quick-access.hi.json'

const LANGS = [
  { id: 'en-IN', label: 'English', phrases: en as PhraseSet },
  { id: 'hi-IN', label: 'Hindi', phrases: hi as PhraseSet },
]

async function speakOnServer(text: string, lang: string) {
  const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang: lang.split('-')[0] }) })
  if (!res.ok) throw new Error('server voice unavailable')
  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  await audio.play()
}

export default function TextToSpeechPage() {
  const tts = usePrefs((s) => s.tts)
  const setPref = usePrefs((s) => s.set)
  const [text, setText] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [state, setState] = useState<TtsState>('idle')
  const [charAt, setCharAt] = useState(-1)
  const [spoken, setSpoken] = useState('')
  const speaker = useRef(new Speaker())
  const inputId = useId()
  const lang = LANGS.find((l) => l.id === tts.lang) ?? LANGS[0]!

  useEffect(() => { void getVoices().then(setVoices) }, [])
  useEffect(() => () => speaker.current.stop(), [])

  const ranked = useMemo(() => rankVoices(voices, lang.id), [voices, lang.id])
  const voice = ranked.find((v) => v.voiceURI === tts.voiceURI) ?? ranked[0] ?? null

  const say = (t: string) => {
    const clean = t.trim()
    if (!clean) return
    setSpoken(clean)
    if (!speaker.current.supported || voices.length === 0) {
      speakOnServer(clean, lang.id).catch(() => toast('No voice is available on this device, and the server voice did not respond.'))
      return
    }
    speaker.current.speak(clean, {
      voice,
      lang: lang.id,
      rate: levelToRate(tts.rate),
      onWord: setCharAt,
      onState: setState,
      onError: (m) => toast(m),
    })
  }

  const spans = useMemo(() => wordSpans(spoken), [spoken])
  const current = spans.findIndex(([s, e]) => charAt >= s && charAt < e)

  return (
    <ToolFrame
      title="Text to speech"
      purpose="Type something, or tap a phrase, and it is spoken aloud."
      privacy={{ where: 'device', detail: 'Spoken by your device' }}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel label="Message" className="flex flex-col gap-4 p-5">
          <div>
            <label htmlFor={inputId} className="mb-1.5 block font-medium">Your message</label>
            <textarea
              id={inputId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) say(text) }}
              rows={5}
              lang={lang.id}
              placeholder="Type here"
              className="w-full resize-y rounded-[10px] border border-line bg-bg px-4 py-3 text-[1.25rem] leading-snug text-ink outline-none placeholder:text-ink-muted focus:border-brand"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Language" value={lang.id} onChange={(e) => setPref('tts', { ...tts, lang: e.target.value, voiceURI: undefined })}>
              {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </Select>
            <Select label="Voice" value={voice?.voiceURI ?? ''} onChange={(e) => setPref('tts', { ...tts, voiceURI: e.target.value })} disabled={!ranked.length}>
              {ranked.length ? ranked.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{v.localService ? '' : ' (online)'}</option>) : <option value="">Server voice</option>}
            </Select>
          </div>
          <Slider label="Speed" value={tts.rate} min={1} max={10} step={1} onChange={(v) => setPref('tts', { ...tts, rate: v })} format={(v) => `${v} of 10`} minLabel="Slower" maxLabel="Faster" />
          <div className="mt-auto flex flex-wrap gap-2">
            <Button variant="primary" size="lg" className="flex-1" onClick={() => say(text)} disabled={!text.trim()} icon={<Play aria-hidden size={18} />}>Speak</Button>
            {state === 'speaking' && <Button size="lg" onClick={() => speaker.current.pause()} icon={<Pause aria-hidden size={18} />}>Pause</Button>}
            {state === 'paused' && <Button size="lg" onClick={() => speaker.current.resume()} icon={<Play aria-hidden size={18} />}>Resume</Button>}
            {state !== 'idle' && <Button size="lg" onClick={() => speaker.current.stop()} icon={<Square aria-hidden size={16} />}>Stop</Button>}
            {state === 'idle' && spoken && <Button size="lg" onClick={() => say(spoken)} icon={<RotateCcw aria-hidden size={16} />}>Repeat</Button>}
          </div>
        </Panel>

        <Panel label="Live caption" className="flex min-h-56 flex-col p-5">
          <p className="mb-3 text-[0.875rem] font-medium text-ink-muted">Live caption</p>
          {spoken ? (
            <p className="max-w-none text-[clamp(1.5rem,1.1rem+1.4vw,2.125rem)] font-medium leading-snug" lang={lang.id}>
              {spans.map(([s, e], i) => (
                <span key={s} className={`rounded-[4px] transition-colors duration-100 ${i === current ? 'bg-live-fill text-white' : i < current ? 'text-ink' : state === 'idle' ? 'text-ink' : 'text-ink-muted'}`}>
                  {spoken.slice(s, e)}{' '}
                </span>
              ))}
            </p>
          ) : (
            <p className="text-ink-muted">What you speak shows here, one word at a time.</p>
          )}
          <p className="sr-only" aria-live="polite">{state === 'speaking' ? 'Speaking' : state === 'paused' ? 'Paused' : ''}</p>
        </Panel>
      </div>

      <div className="mt-4">
        <QuickAccess set={lang.phrases} onPick={(t) => { setText(t); say(t) }} />
      </div>
    </ToolFrame>
  )
}
