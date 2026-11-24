import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Copy, Trash2, Download, Volume2, Maximize2, Cpu, X } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Select, Panel } from '@/components/tool/Field'
import { toast } from '@/components/ui/Toast'
import { BrowserStt } from '@/engines/speech/stt'
import { punctuateSegment, joinSegments } from '@/engines/speech/punctuate'
import { isBrave } from '@/engines/platform/brave'
import { startPcmCapture, type PcmCapture } from '@/engines/speech/pcmCapture'
import { WhisperClient } from '@/engines/speech/whisperClient'
import { Speaker } from '@/engines/speech/tts'
import { usePrefs } from '@/stores/prefs'

type Engine = 'browser' | 'whisper'
const LANGS = [
  { id: 'en-IN', label: 'English (India)' },
  { id: 'en-US', label: 'English (US)' },
  { id: 'hi-IN', label: 'Hindi' },
] as const

export default function SpeechToTextPage() {
  const stt = usePrefs((s) => s.stt)
  const setPref = usePrefs((s) => s.set)
  const [segments, setSegments] = useState<string[]>([])
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [engine, setEngine] = useState<Engine>('browser')
  const [browserOk, setBrowserOk] = useState(true)
  const [whisper, setWhisper] = useState<'off' | 'loading' | 'ready'>('off')
  const [progress, setProgress] = useState(0)
  const [captions, setCaptions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const browser = useRef<BrowserStt | null>(null)
  const wClient = useRef<WhisperClient | null>(null)
  const capture = useRef<PcmCapture | null>(null)
  const speaker = useRef(new Speaker())

  useEffect(() => {
    void isBrave().then((brave) => {
      if (brave || !BrowserStt.supported()) { setBrowserOk(false); setEngine('whisper') }
    })
    return () => { browser.current?.stop(); capture.current?.stop(); wClient.current?.dispose(); speaker.current.stop() }
  }, [])

  const addFinal = (raw: string) => {
    const seg = stt.smartPunctuation ? punctuateSegment(raw, stt.lang) : raw.trim()
    if (seg) setSegments((s) => [...s, seg])
  }

  const startBrowser = () => {
    setError(null)
    browser.current = new BrowserStt({
      onInterim: setInterim,
      onFinal: (t) => { setInterim(''); addFinal(t) },
      onState: setListening,
      onError: (code, message) => {
        setError(message)
        setListening(false)
        if (code === 'network' || code === 'unsupported') { setBrowserOk(false); setEngine('whisper') }
      },
    })
    browser.current.start(stt.lang)
  }

  const loadWhisper = async () => {
    setWhisper('loading'); setError(null)
    wClient.current = new WhisperClient()
    wClient.current.onProgress = setProgress
    try { await wClient.current.load(); setWhisper('ready') }
    catch { setWhisper('off'); setError('The on-device model could not download. Check your connection and try again.') }
  }

  const startWhisper = async () => {
    setError(null)
    try {
      capture.current = await startPcmCapture(async (pcm) => {
        setInterim('Transcribing…')
        const text = await wClient.current!.transcribe(pcm)
        setInterim('')
        if (text && !/^\[.*\]$/.test(text)) addFinal(text)
      })
      setListening(true)
    } catch {
      setError('Microphone blocked. Allow the microphone in the address bar, then press Start listening again.')
    }
  }

  const toggle = () => {
    if (listening) {
      browser.current?.stop(); capture.current?.stop(); capture.current = null
      setListening(false); setInterim('')
      return
    }
    if (engine === 'browser') startBrowser()
    else if (whisper === 'ready') void startWhisper()
  }

  const transcript = joinSegments(segments)
  const lastLines = (transcript + (interim ? ` ${interim}` : '')).split(/(?<=[.?!।])\s+/).slice(-2).join(' ')

  const copy = async () => { await navigator.clipboard.writeText(transcript); toast('Copied') }
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([transcript], { type: 'text/plain' }))
    a.download = `bridgify-transcript-${new Date().toISOString().slice(0, 16).replace(':', '')}.txt`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const canListen = engine === 'browser' ? browserOk : whisper === 'ready'

  return (
    <ToolFrame
      title="Speech to text"
      purpose="Live text of what someone says, with punctuation added."
      privacy={{ where: 'device', detail: engine === 'whisper' ? 'Recognised on this device' : "Uses your browser's speech service" }}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <Panel label="Controls" className="flex flex-col gap-5 p-5">
          <button
            type="button"
            onClick={toggle}
            disabled={!canListen}
            aria-pressed={listening}
            className={`press flex min-h-28 flex-col items-center justify-center gap-2 rounded-[12px] font-medium disabled:opacity-50 ${listening ? 'bg-live-fill text-white' : 'bg-brand text-brand-ink hover:opacity-90'}`}
          >
            {listening ? <MicOff aria-hidden size={28} /> : <Mic aria-hidden size={28} />}
            {listening ? 'Stop listening' : 'Start listening'}
          </button>
          <p role="status" className="-mt-2 text-center text-[0.9375rem] text-ink-muted">
            {listening ? 'Listening. Speak normally.' : canListen ? 'Ready' : engine === 'whisper' && whisper !== 'ready' ? 'Turn on on-device recognition below' : ''}
          </p>
          {error && <p role="alert" className="rounded-[10px] border border-danger/40 bg-surface-2 px-3 py-2 text-[0.9375rem]">{error}</p>}

          <Select label="Language" value={stt.lang} onChange={(e) => setPref('stt', { ...stt, lang: e.target.value as typeof stt.lang })} disabled={listening || engine === 'whisper'}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </Select>
          <div>
            <Switch label="Smart punctuation" checked={stt.smartPunctuation} onChange={(v) => setPref('stt', { ...stt, smartPunctuation: v })} />
          </div>

          {(engine === 'whisper' || !browserOk) ? (
            whisper !== 'ready' && (
              <div className="rounded-[12px] border border-line bg-bg p-4">
                <p className="flex items-center gap-2 font-medium"><Cpu aria-hidden size={18} /> On-device recognition</p>
                <p className="mt-1 text-[0.9375rem] text-ink-muted">
                  {browserOk ? 'Better in noisy rooms and fully private.' : "This browser can't do speech to text by itself."} Downloads about 40 MB once, then works offline. English only.
                </p>
                {whisper === 'loading' ? (
                  <div className="mt-3" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Downloading">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full origin-left bg-brand transition-transform duration-200" style={{ transform: `scaleX(${progress})` }} /></div>
                    <p className="mt-1.5 text-sm text-ink-muted tabular">{Math.round(progress * 100)}%</p>
                  </div>
                ) : (
                  <Button className="mt-3" onClick={loadWhisper}>Download and turn on</Button>
                )}
              </div>
            )
          ) : (
            <button type="button" className="text-left text-[0.9375rem] text-brand underline underline-offset-4" onClick={() => { browser.current?.stop(); setListening(false); setEngine('whisper') }}>
              Noisy room? Use on-device recognition
            </button>
          )}
          {engine === 'whisper' && browserOk && (
            <button type="button" className="text-left text-[0.9375rem] text-brand underline underline-offset-4" onClick={() => { capture.current?.stop(); setListening(false); setEngine('browser') }}>
              Back to the browser recogniser
            </button>
          )}
        </Panel>

        <Panel label="Transcript" className="flex min-h-80 flex-col p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[0.875rem] font-medium text-ink-muted">Transcript</p>
            <Button variant="quiet" onClick={() => setCaptions(true)} icon={<Maximize2 aria-hidden size={16} />}>Captions view</Button>
          </div>
          <div aria-live="polite" className="flex-1 whitespace-pre-wrap text-[1.375rem] leading-relaxed" lang={stt.lang}>
            {transcript || interim ? (
              <>
                {transcript}
                {interim && <span className="text-ink-muted"> {interim}</span>}
              </>
            ) : (
              <span className="text-ink-muted">Words appear here as they are spoken.</span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => speaker.current.speak(transcript, { lang: stt.lang })} disabled={!transcript} icon={<Volume2 aria-hidden size={16} />}>Speak</Button>
            <Button onClick={copy} disabled={!transcript} icon={<Copy aria-hidden size={16} />}>Copy</Button>
            <Button onClick={download} disabled={!transcript} icon={<Download aria-hidden size={16} />}>Download</Button>
            <Button variant="quiet" onClick={() => { const before = segments; setSegments([]); toast('Transcript cleared', { label: 'Undo', run: () => setSegments(before) }) }} disabled={!transcript} icon={<Trash2 aria-hidden size={16} />}>Clear</Button>
          </div>
        </Panel>
      </div>

      <Dialog.Root open={captions} onOpenChange={(o) => setCaptions(o)}>
        <Dialog.Portal>
          <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-ink p-6 text-bg md:p-12">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-base font-medium opacity-80">Captions</Dialog.Title>
              <Dialog.Close className="press inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-white/10" aria-label="Close captions">
                <X aria-hidden size={24} />
              </Dialog.Close>
            </div>
            <p aria-live="polite" className="mt-auto max-w-none text-[clamp(2rem,1.2rem+3.5vw,4rem)] font-semibold leading-tight" lang={stt.lang}>
              {lastLines || (listening ? 'Listening…' : 'Press Start listening first.')}
            </p>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </ToolFrame>
  )
}
