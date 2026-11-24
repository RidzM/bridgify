import { chunkText, msPerChar, wordSpans } from './chunk'

export interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null
  lang?: string
  rate?: number // 0.5 – 2
  onWord?: (charIndex: number) => void
  onState?: (s: TtsState) => void
  onError?: (message: string) => void
}
export type TtsState = 'idle' | 'speaking' | 'paused'

/** Level 1–10 from the report's speed slider → SpeechSynthesisUtterance.rate (0.5–2.0). */
export const levelToRate = (level: number) => Math.round((0.5 + ((level - 1) * 1.5) / 9) * 100) / 100

/**
 * Speaks text in sentence chunks with word-level callbacks. Uses real boundary events when the
 * voice sends them; otherwise estimates word timing so the caption still follows along.
 */
export class Speaker {
  private synth: SpeechSynthesis | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  private queue: { text: string; start: number }[] = []
  private opts: SpeakOptions = {}
  private state: TtsState = 'idle'
  private estTimer: ReturnType<typeof setTimeout> | null = null
  private keepAlive: ReturnType<typeof setInterval> | null = null
  private gen = 0

  get supported() { return Boolean(this.synth) }

  speak(text: string, opts: SpeakOptions = {}) {
    if (!this.synth) { opts.onError?.('This browser cannot speak text.'); return }
    this.stop()
    this.opts = opts
    this.queue = chunkText(text)
    const gen = ++this.gen
    this.setState('speaking')
    // Chrome pauses long speech after ~15 s unless nudged.
    this.keepAlive = setInterval(() => { if (this.synth?.speaking && !this.synth.paused) { this.synth.pause(); this.synth.resume() } }, 10000)
    this.next(gen)
  }

  private next(gen: number) {
    if (gen !== this.gen || !this.synth) return
    const chunk = this.queue.shift()
    if (!chunk) { this.finish(); return }
    const u = new SpeechSynthesisUtterance(chunk.text)
    if (this.opts.voice) u.voice = this.opts.voice
    if (this.opts.lang) u.lang = this.opts.voice?.lang ?? this.opts.lang
    u.rate = this.opts.rate ?? 1
    let sawBoundary = false
    u.onboundary = (e) => {
      if (gen !== this.gen) return
      if (e.name && e.name !== 'word') return
      sawBoundary = true
      this.clearEst()
      this.opts.onWord?.(chunk.start + e.charIndex)
    }
    u.onstart = () => {
      if (gen !== this.gen) return
      this.opts.onWord?.(chunk.start)
      // Fallback: if no boundary event arrives soon, estimate word timing.
      const spans = wordSpans(chunk.text)
      let i = 0
      const step = () => {
        if (sawBoundary || gen !== this.gen) return
        if (this.state === 'paused') { this.estTimer = setTimeout(step, 120); return }
        const s = spans[i]
        if (!s) return
        this.opts.onWord?.(chunk.start + s[0])
        const len = (spans[i + 1]?.[0] ?? chunk.text.length) - s[0]
        i++
        this.estTimer = setTimeout(step, len * msPerChar(u.rate))
      }
      this.estTimer = setTimeout(() => { if (!sawBoundary) step() }, 400)
    }
    u.onend = () => { this.clearEst(); this.next(gen) }
    u.onerror = (e) => {
      this.clearEst()
      if (e.error === 'interrupted' || e.error === 'canceled') return
      this.opts.onError?.('Speech stopped unexpectedly. Try another voice.')
      this.finish()
    }
    this.synth.speak(u)
  }

  pause() { if (this.state === 'speaking') { this.synth?.pause(); this.setState('paused') } }
  resume() { if (this.state === 'paused') { this.synth?.resume(); this.setState('speaking') } }

  stop() {
    this.gen++
    this.queue = []
    this.clearEst()
    if (this.keepAlive) clearInterval(this.keepAlive)
    this.keepAlive = null
    this.synth?.cancel()
    if (this.state !== 'idle') this.setState('idle')
  }

  private finish() {
    if (this.keepAlive) clearInterval(this.keepAlive)
    this.keepAlive = null
    this.setState('idle')
    this.opts.onWord?.(-1)
  }
  private clearEst() { if (this.estTimer) clearTimeout(this.estTimer); this.estTimer = null }
  private setState(s: TtsState) { this.state = s; this.opts.onState?.(s) }
}
