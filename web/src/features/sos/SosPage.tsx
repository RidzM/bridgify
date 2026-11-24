import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Hand, MapPin, Maximize2, Phone, Siren, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Speaker, levelToRate } from '@/engines/speech/tts'
import { getVoices, rankVoices } from '@/engines/speech/voices'
import { LazySigns } from './LazySigns'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { usePrefs } from '@/stores/prefs'
import { BrailleLine } from './BrailleLine'
import { MyDetails } from './MyDetails'
import { ShowMode } from './ShowMode'
import { buildCards, type SosCard } from './cards'
import { mapsLink, parseContact } from './contact'

type Where = { state: 'idle' } | { state: 'finding' } | { state: 'found'; url: string; note: string } | { state: 'error'; message: string }

/** SOS (FR-SOS-01, 02): cards to show or speak, a one-tap call, and location sharing. Works offline. */
export default function SosPage() {
  useDocumentTitle('SOS')
  const details = usePrefs((s) => s.sos)
  const tts = usePrefs((s) => s.tts)
  const cards = useMemo(() => buildCards(details), [details])
  const contact = useMemo(() => parseContact(details.contact), [details.contact])
  const [showing, setShowing] = useState<SosCard | null>(null)
  const [signing, setSigning] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [where, setWhere] = useState<Where>({ state: 'idle' })
  const contactInput = useRef<HTMLInputElement>(null)
  const speaker = useRef(new Speaker())
  const voices = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    void getVoices().then((v) => { voices.current = v })
    const s = speaker.current
    return () => s.stop()
  }, [])
  useEffect(() => { if (editing && !details.contact) contactInput.current?.focus() }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const speak = (card: SosCard) => {
    if (!speaker.current.supported) { toast("This device can't speak. Show the screen instead."); return }
    const voice = rankVoices(voices.current, 'en-IN').find((v) => v.voiceURI === tts.voiceURI) ?? rankVoices(voices.current, 'en-IN')[0] ?? null
    speaker.current.speak(card.speech, { voice, lang: 'en-IN', rate: Math.min(levelToRate(tts.rate), 1), onError: () => toast("This device couldn't speak. Show the screen instead.") })
  }

  const shareLocation = () => {
    if (!('geolocation' in navigator)) { setWhere({ state: 'error', message: "This device can't share its location." }); return }
    setWhere({ state: 'finding' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const url = mapsLink(pos.coords.latitude, pos.coords.longitude)
        const text = `${details.name ? `${details.name} needs help.` : 'I need help.'} My location (within about ${Math.max(5, Math.round(pos.coords.accuracy))} m):`
        if (navigator.share) {
          try { await navigator.share({ title: 'My location', text, url }); setWhere({ state: 'found', url, note: 'Shared.' }); return }
          catch (e) { if ((e as DOMException).name === 'AbortError') { setWhere({ state: 'found', url, note: 'Not shared. You can copy the link.' }); return } }
        }
        try { await navigator.clipboard.writeText(`${text} ${url}`); setWhere({ state: 'found', url, note: 'Copied. Paste it into a message.' }) }
        catch { setWhere({ state: 'found', url, note: 'Copy this link into a message.' }) }
      },
      (err) => setWhere({
        state: 'error',
        message: err.code === err.PERMISSION_DENIED
          ? 'Location is blocked. Allow location for this site in the address bar, then press Share my location again.'
          : "Couldn't find your location. Move near a window or outside, then try again.",
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-6 md:px-8 md:pt-10">
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3">
            <Siren aria-hidden size={30} strokeWidth={1.75} className="shrink-0 text-danger" />
            SOS
          </h1>
          <p className="mt-1.5 text-ink-muted">Show a card to someone, or press Speak. Works without internet.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:shrink-0">
          {contact.tel ? (
            <a href={`tel:${contact.tel}`} className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-danger px-5 font-medium text-danger-ink no-underline hover:opacity-90">
              <Phone aria-hidden size={18} /> Call {contact.label}
            </a>
          ) : (
            <Button size="lg" onClick={() => setEditing(true)} icon={<Phone aria-hidden size={18} />}>Add an emergency contact</Button>
          )}
          <Button size="lg" onClick={shareLocation} disabled={where.state === 'finding'} icon={<MapPin aria-hidden size={18} />}>
            {where.state === 'finding' ? 'Finding your location…' : 'Share my location'}
          </Button>
        </div>
      </header>

      {where.state === 'found' && (
        <p role="status" className="mb-6 max-w-none rounded-[12px] border border-line bg-surface px-4 py-3">
          Your location: <a href={where.url} target="_blank" rel="noopener" className="break-all">{where.url}</a>. {where.note}
        </p>
      )}
      {where.state === 'error' && <p role="alert" className="mb-6 max-w-none rounded-[12px] border border-line-strong bg-surface px-4 py-3">{where.message}</p>}

      <ul aria-label="Cards to show or speak" className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.id} card={c} signing={signing === c.id} onSign={() => setSigning((s) => (s === c.id ? null : c.id))} onSpeak={speak} onShow={setShowing} />
        ))}
      </ul>

      <div className="mt-8">
        <MyDetails ref={contactInput} editing={editing} onEditing={setEditing} />
      </div>

      <ShowMode card={showing} onClose={() => setShowing(null)} onSpeak={speak} />
    </div>
  )
}

interface CardProps { card: SosCard; signing: boolean; onSign: () => void; onSpeak: (c: SosCard) => void; onShow: (c: SosCard) => void }

/** One phrase: large text, Hindi, braille, and on request its ISL signs (one card at a time, so
 *  the page stays fast and quiet). Full screen shows everything at once. */
function Card({ card, signing, onSign, onSpeak, onShow }: CardProps) {
  const textId = useId()
  const signId = useId()
  return (
    <li className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-5 md:p-6">
      <div>
        <p id={textId} lang="en" className="max-w-none font-semibold leading-[1.12] tracking-[-0.01em] text-[clamp(1.75rem,1.35rem+1.3vw,2.375rem)]">{card.text}</p>
        {card.extra && <p className="mt-2 max-w-none whitespace-pre-line break-words text-[1.375rem] font-medium tabular">{card.extra}</p>}
        {card.hi && <p lang="hi" className="mt-2 text-[1.125rem] text-ink-muted">{card.hi}</p>}
      </div>
      <BrailleLine text={card.text} size={17} />
      {signing && <div id={signId}><LazySigns text={card.text} lang="isl" autoPlay compact /></div>}
      <div className="mt-auto flex flex-wrap gap-2">
        <Button onClick={() => onSpeak(card)} aria-describedby={textId} icon={<Volume2 aria-hidden size={18} />}>Speak</Button>
        <Button onClick={onSign} aria-expanded={signing} aria-controls={signing ? signId : undefined} aria-describedby={textId} icon={<Hand aria-hidden size={17} />}>{signing ? 'Hide signs' : 'Sign it'}</Button>
        <Button onClick={() => onShow(card)} aria-describedby={textId} icon={<Maximize2 aria-hidden size={16} />}>Show full screen</Button>
      </div>
    </li>
  )
}
