/** Loads browser voices (they arrive asynchronously in Chrome) and ranks them for a language. */
export function getVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synth) return Promise.resolve([])
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); resolve(synth.getVoices()) }
    synth.addEventListener?.('voiceschanged', done)
    setTimeout(done, timeoutMs)
  })
}

/** Prefer on-device voices (they report word boundaries and don't cut off), then exact language match. */
export function rankVoices(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  const base = lang.split('-')[0]!.toLowerCase()
  const score = (v: SpeechSynthesisVoice) => {
    const vl = v.lang.toLowerCase().replace('_', '-')
    let s = 0
    if (vl === lang.toLowerCase()) s += 4
    else if (vl.startsWith(base)) s += 2
    else return -1
    if (v.localService) s += 3
    if (v.default) s += 1
    return s
  }
  return voices.map((v) => ({ v, s: score(v) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.v)
}
