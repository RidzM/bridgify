/** Lazy access to sign content (lexicons, fingerspelling, phrases). Each file is its own chunk. */
import type { SignLang } from '@/stores/prefs'

export interface LexEntry {
  gloss: string
  words: string[]
  pose: string | null
  video: { src: string; poster?: string; credit?: string } | null
  source?: string
}
export interface Lexicon { lang: SignLang; spoken: string; entries: LexEntry[] }
export interface LetterItem { letter?: string; value?: string; media: { type: 'svg' | 'image' | 'pose'; src: string } | null; motion?: boolean; tip?: string; credit?: string }
export interface Fingerspelling { lang: SignLang; code: string; handed: 'one' | 'two'; chart?: string | null; letters: LetterItem[]; numbers: LetterItem[] }
export interface PhraseSetT { lang: SignLang; spoken: string; phrases: { text: string; en: string; media: { type: 'pose'; src: string } | null }[] }

const lexicons = import.meta.glob<Lexicon>('@content/lexicons/*.json', { import: 'default' })
const fingers = import.meta.glob<Fingerspelling>('@content/tutorials/fingerspelling/*.json', { import: 'default' })
const phrases = import.meta.glob<PhraseSetT>('@content/tutorials/phrases/*.json', { import: 'default' })

const pick = <T,>(m: Record<string, () => Promise<T>>, lang: string) => {
  const key = Object.keys(m).find((k) => k.endsWith(`/${lang}.json`))
  return key ? m[key]!() : Promise.resolve(null)
}
export const loadLexicon = (lang: SignLang) => pick(lexicons, lang)
export const loadFingerspelling = (lang: SignLang) => pick(fingers, lang)
export const loadPhrases = (lang: SignLang) => pick(phrases, lang)
