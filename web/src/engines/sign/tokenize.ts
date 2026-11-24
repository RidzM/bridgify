import type { LexEntry } from './content'

export interface Token { text: string; entry: LexEntry | null }

export const normalise = (s: string) =>
  s.toLowerCase().normalize('NFC').replace(/[“”"«»¿¡!?.,;:()]/g, ' ').replace(/\s+/g, ' ').trim()

/** Greedy longest match of lexicon phrases ("thank you" before "thank"). */
export function tokenize(text: string, entries: LexEntry[]): Token[] {
  const index = new Map<string, LexEntry>()
  let maxLen = 1
  for (const e of entries) for (const w of e.words) {
    const k = normalise(w)
    if (!k) continue
    if (!index.has(k)) index.set(k, e)
    maxLen = Math.max(maxLen, k.split(' ').length)
  }
  const words = normalise(text).split(' ').filter(Boolean)
  const out: Token[] = []
  for (let i = 0; i < words.length;) {
    let matched = false
    for (let n = Math.min(maxLen, words.length - i); n >= 1; n--) {
      const k = words.slice(i, i + n).join(' ')
      const e = index.get(k)
      if (e) { out.push({ text: k, entry: e }); i += n; matched = true; break }
    }
    if (!matched) { out.push({ text: words[i]!, entry: null }); i++ }
  }
  return out
}
