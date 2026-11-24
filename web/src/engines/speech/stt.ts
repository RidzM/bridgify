/* Wrapper around the browser speech recognizer with auto-restart and plain-language errors. */
type SR = {
  lang: string; continuous: boolean; interimResults: boolean; processLocally?: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
type SRCtor = new () => SR

export function recognizerCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface SttCallbacks {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onState: (listening: boolean) => void
  onError: (code: SttError, message: string) => void
}
export type SttError = 'not-allowed' | 'no-mic' | 'network' | 'unsupported' | 'other'

const MESSAGES: Record<SttError, string> = {
  'not-allowed': 'Microphone blocked. Allow the microphone in the address bar, then press Start listening again.',
  'no-mic': 'No microphone found. Plug one in or try another device.',
  network: "This browser's speech service isn't reachable. Use the on-device option below.",
  unsupported: "This browser can't turn speech into text by itself. Use the on-device option below.",
  other: 'Listening stopped. Press Start listening to try again.',
}

export class BrowserStt {
  private rec: SR | null = null
  private want = false
  private networkErrors = 0
  private cb: SttCallbacks
  constructor(cb: SttCallbacks) { this.cb = cb }

  static supported() { return recognizerCtor() !== null }

  start(lang: string) {
    const Ctor = recognizerCtor()
    if (!Ctor) { this.cb.onError('unsupported', MESSAGES.unsupported); return }
    this.want = true
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    if ('processLocally' in rec) { try { rec.processLocally = true } catch { /* not supported for this language */ } }
    rec.onstart = () => this.cb.onState(true)
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!
        if (r.isFinal) this.cb.onFinal(r[0].transcript)
        else interim += r[0].transcript
      }
      this.networkErrors = 0
      this.cb.onInterim(interim)
    }
    rec.onerror = (e) => {
      const code: SttError = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed'
        : e.error === 'audio-capture' ? 'no-mic'
        : e.error === 'network' || e.error === 'language-not-supported' ? 'network'
        : e.error === 'no-speech' || e.error === 'aborted' ? 'other' : 'other'
      if (e.error === 'no-speech' || e.error === 'aborted') return // auto-restart handles it
      if (code === 'network' && ++this.networkErrors < 2) return
      this.want = false
      this.cb.onError(code, MESSAGES[code])
    }
    rec.onend = () => {
      if (this.want) { try { rec.start() } catch { this.want = false; this.cb.onState(false) } }
      else this.cb.onState(false)
    }
    this.rec = rec
    try { rec.start() } catch { this.cb.onError('other', MESSAGES.other) }
  }

  stop() { this.want = false; this.rec?.stop() }
}
