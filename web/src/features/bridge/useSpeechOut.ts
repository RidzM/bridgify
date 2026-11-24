import { useEffect, useState, useSyncExternalStore } from 'react'
import { Speaker, levelToRate } from '@/engines/speech/tts'
import { getVoices, rankVoices } from '@/engines/speech/voices'
import type { ChatMessage } from '@/engines/bridge/session'
import { usePrefs } from '@/stores/prefs'

async function speakOnServer(text: string, lang: string) {
  const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 600), lang: lang.split('-')[0] }) })
  if (!res.ok) throw new Error('server voice unavailable')
  const url = URL.createObjectURL(await res.blob())
  const audio = new Audio(url)
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('playback failed'))
    audio.play().catch(reject)
  }).finally(() => URL.revokeObjectURL(url))
}

const hasActivation = () => (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true

interface View { speakingId: string | null; charAt: number; unavailable: boolean }

/** Reads messages aloud in order (at most 5 waiting). One generation number per utterance keeps
 *  stale end-of-speech callbacks from skipping the next message. */
class SpeechQueue {
  private speaker = new Speaker()
  private queue: ChatMessage[] = []
  private busy = false
  private gen = 0
  private watchdog: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<() => void>()
  private voices: SpeechSynthesisVoice[] = []
  private settings: { rate: number; lang: string; voiceURI?: string } = { rate: 5, lang: 'en-IN' }
  view: View = { speakingId: null, charAt: -1, unavailable: false }

  setVoices(v: SpeechSynthesisVoice[]) { this.voices = v }
  configure(s: { rate: number; lang: string; voiceURI?: string }) { this.settings = s }
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private set(p: Partial<View>) { this.view = { ...this.view, ...p }; for (const fn of this.listeners) fn() }

  say(m: ChatMessage) {
    this.queue.push(m)
    if (this.queue.length > 5) this.queue.splice(0, this.queue.length - 5)
    if (!this.busy) this.next()
  }

  private next() {
    if (this.watchdog) clearTimeout(this.watchdog)
    const my = ++this.gen
    const m = this.queue.shift()
    if (!m) { this.busy = false; this.set({ speakingId: null, charAt: -1 }); return }
    this.busy = true
    this.set({ speakingId: m.id, charAt: -1 })
    const done = () => { if (my === this.gen) this.next() }
    // If speech never reports the end (some devices), move on after a generous estimate.
    this.watchdog = setTimeout(() => { if (my !== this.gen) return; this.gen++; this.speaker.stop(); this.next() }, 4000 + m.text.length * 120)
    if (!this.speaker.supported || this.voices.length === 0) {
      speakOnServer(m.text, m.lang).catch(() => this.set({ unavailable: true })).finally(done)
      return
    }
    const ranked = rankVoices(this.voices, m.lang || this.settings.lang)
    const voice = ranked.find((v) => v.voiceURI === this.settings.voiceURI) ?? ranked[0] ?? null
    this.speaker.speak(m.text, {
      voice,
      lang: m.lang,
      rate: levelToRate(this.settings.rate),
      onWord: (c) => { if (my === this.gen) this.set({ charAt: c }) },
      onState: (s) => { if (s === 'idle') done() },
      onError: () => this.set({ unavailable: true }),
    })
  }

  stop() {
    this.gen++
    if (this.watchdog) clearTimeout(this.watchdog)
    this.watchdog = null
    this.queue = []
    this.busy = false
    this.speaker.stop()
    if (this.view.speakingId) this.set({ speakingId: null, charAt: -1 })
  }

  repeat(m: ChatMessage) { this.stop(); this.say(m) }
}

export interface SpeechOut extends View { needsTap: boolean; repeat: (m: ChatMessage) => void; enable: () => void }

/**
 * Receive = speech: reads each new message aloud. Browsers only allow speech after the person
 * has tapped the page once, so `needsTap` asks for that tap when it is missing.
 */
export function useSpeechOut(latest: ChatMessage | null, enabled: boolean): SpeechOut {
  const tts = usePrefs((s) => s.tts)
  const [q] = useState(() => new SpeechQueue())
  const [tapped, setTapped] = useState(false)
  // The message already on screen when the view opens (restored after a reload) isn't re-read.
  const [firstId] = useState(() => latest?.id ?? null)
  const view = useSyncExternalStore(q.subscribe, () => q.view)

  useEffect(() => { void getVoices().then((v) => q.setVoices(v)) }, [q])
  useEffect(() => { q.configure({ rate: tts.rate, lang: tts.lang, voiceURI: tts.voiceURI }) }, [q, tts])
  useEffect(() => () => q.stop(), [q])

  const allowed = tapped || hasActivation()
  useEffect(() => {
    if (enabled && latest && allowed && latest.id !== firstId) q.say(latest)
  }, [latest?.id, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!enabled) q.stop() }, [enabled, q])

  return {
    ...view,
    needsTap: enabled && Boolean(latest) && !allowed,
    repeat: (m) => q.repeat(m),
    enable: () => { setTapped(true); if (latest) q.say(latest) },
  }
}
