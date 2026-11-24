import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { BrowserStt } from '@/engines/speech/stt'
import { punctuateSegment } from '@/engines/speech/punctuate'
import { isBrave } from '@/engines/platform/brave'

interface Props { lang: string; onSend: (text: string) => void; onListening: (listening: boolean) => void }

const NO_STT = "This browser can't turn speech into text by itself. Choose Type, or open Bridge in Chrome or Edge."

/** Speak: each finished sentence is punctuated and sent as soon as you pause. */
export function SpeakSender({ lang, onSend, onListening }: Props) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(BrowserStt.supported() ? null : NO_STT)
  const stt = useRef<BrowserStt | null>(null)
  const cb = useRef({ onSend, onListening })
  useLayoutEffect(() => { cb.current = { onSend, onListening } })

  useEffect(() => {
    void isBrave().then((brave) => { if (brave) setError(NO_STT) })
    return () => { stt.current?.stop(); cb.current.onListening(false) }
  }, [])

  const toggle = () => {
    if (listening) { stt.current?.stop(); return }
    setError(null)
    stt.current = new BrowserStt({
      onInterim: setInterim,
      onFinal: (t) => { setInterim(''); const seg = punctuateSegment(t, lang); if (seg) cb.current.onSend(seg) },
      onState: (l) => { setListening(l); cb.current.onListening(l); if (!l) setInterim('') },
      onError: (code, message) => {
        setListening(false)
        cb.current.onListening(false)
        setError(code === 'network' || code === 'unsupported' ? NO_STT : message)
      },
    })
    stt.current.start(lang)
  }

  const blocked = error === NO_STT
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={blocked}
        aria-pressed={listening}
        className={`press flex min-h-20 items-center justify-center gap-3 rounded-[12px] text-[1.0625rem] font-medium disabled:opacity-50 ${listening ? 'bg-live-fill text-white' : 'bg-brand text-brand-ink hover:opacity-90'}`}
      >
        {listening ? <MicOff aria-hidden size={24} /> : <Mic aria-hidden size={24} />}
        {listening ? 'Stop listening' : 'Start listening'}
      </button>
      <p role="status" className="min-h-6 text-[0.9375rem] text-ink-muted">
        {listening ? (interim ? <span className="text-ink">{interim}</span> : 'Listening. Each sentence is sent when you pause.') : ''}
      </p>
      {error && <p role="alert" className="rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[0.9375rem]">{error}</p>}
    </div>
  )
}
