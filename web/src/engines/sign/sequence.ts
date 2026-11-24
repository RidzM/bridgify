/**
 * Turns text into a playable sign sequence for one sign language:
 *   1. lexicon entry with a prepared animation (or real signer video)
 *   2. only when asked (opts.live): a live animation from sign.mt. Off in the app: since 24 Nov 2026 sign.mt
 *      refuses requests from other websites (HTTP 403 "Access denied"), and Bridgify respects that (D-39)
 *   3. otherwise fingerspelling, one letter card per letter
 */
import type { SignLang } from '@/stores/prefs'
import { signLang } from '@/lib/signLangs'
import { loadLexicon, loadFingerspelling, type LetterItem } from './content'
import { tokenize, type Token } from './tokenize'
import { islGloss } from './gloss'
import { isSyntheticFingerspelling, readPose } from './poseFile'
import { compactPose, type CompactPose } from './poseCompact'

export type SignItem =
  | { kind: 'pose'; label: string; pose: CompactPose; source: 'lexicon' | 'live' }
  | { kind: 'video'; label: string; src: string; poster?: string }
  | { kind: 'letter'; label: string; word: string; media: LetterItem['media']; motion?: boolean; tip?: string }

/** `spelled` lists the words that had no stored sign and are fingerspelled instead. */
export interface SignPlan { items: SignItem[]; gloss: string[] | null; spelled: string[] }

const poseCache = new Map<string, Promise<CompactPose>>()
const LIVE_CACHE = 'bridgify-signs-live-v1'

export function fetchCompact(src: string): Promise<CompactPose> {
  let p = poseCache.get(src)
  if (!p) {
    p = fetch(src).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<CompactPose> })
    p.catch(() => poseCache.delete(src))
    poseCache.set(src, p)
  }
  return p
}

export async function fetchLivePose(text: string, lang: SignLang, timeoutMs = 20000): Promise<CompactPose> {
  const { signed, spoken } = signLang(lang).signMt
  const url = `https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose?text=${encodeURIComponent(text)}&spoken=${spoken}&signed=${signed}`
  const cache = 'caches' in self ? await caches.open(LIVE_CACHE).catch(() => null) : null
  let res = await cache?.match(url)
  let fresh = false
  if (!res) {
    // One retry for a server error: the free service sometimes fails on a cold start.
    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      try { res = await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(t) }
      if (res.ok || res.status < 500 || attempt === 1) break
      await new Promise((r) => setTimeout(r, 800))
    }
    if (!res.ok) throw new Error(`no sign (${res.status})`)
    fresh = true
  }
  const buf = await res.arrayBuffer()
  const pose = readPose(buf)
  // A 200 can still mean "no sign": sign.mt then spells the word with ASL letters. Use our own fingerspelling instead.
  if (isSyntheticFingerspelling(pose)) throw new Error('no sign (fingerspelled by the service)')
  if (fresh) await cache?.put(url, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => {})
  const c = compactPose(pose)
  if (!c.frames) throw new Error('empty sign')
  return c
}

export async function planSigns(text: string, lang: SignLang, opts: { live?: boolean } = {}): Promise<SignPlan> {
  const [lex, fs] = await Promise.all([loadLexicon(lang), loadFingerspelling(lang)])
  const entries = lex?.entries ?? []
  const gloss = lang === 'isl' && /[a-z]/i.test(text) ? islGloss(text) : null
  const tokens = tokenize(gloss ? gloss.join(' ') : text, entries)
  const letterMap = new Map((fs?.letters ?? []).map((l) => [(l.letter ?? '').toUpperCase(), l]))
  const items: SignItem[] = []
  const spelled: string[] = []
  const fingerspell = (word: string) => {
    if (!spelled.includes(word)) spelled.push(word)
    for (const ch of word.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '')) {
      const l = letterMap.get(ch)
      items.push({ kind: 'letter', label: ch, word, media: l?.media ?? null, motion: l?.motion, tip: l?.tip })
    }
  }
  const resolve = async (t: Token, split: boolean): Promise<void> => {
    const e = t.entry
    if (e?.video) { items.push({ kind: 'video', label: e.gloss, src: e.video.src, poster: e.video.poster }); return }
    if (e?.pose) {
      try { items.push({ kind: 'pose', label: e.gloss, pose: await fetchCompact(e.pose), source: 'lexicon' }); return } catch { /* fall through */ }
    }
    const phrase = split && t.text.includes(' ')
    if (opts.live === true && navigator.onLine) {
      // Gloss words are upper case; the live service expects ordinary text.
      try { items.push({ kind: 'pose', label: t.text.toUpperCase(), pose: await fetchLivePose(gloss ? t.text.toLowerCase() : t.text, lang), source: 'live' }); return }
      catch { /* fall back below */ }
    }
    // A stored phrase that couldn't load is signed word by word instead.
    if (phrase) {
      for (const w of t.text.split(' ')) for (const sub of tokenize(w, entries)) await resolve(sub, false)
      return
    }
    fingerspell(t.text)
  }
  for (const t of tokens) await resolve(t, true)
  return { items, gloss, spelled }
}
