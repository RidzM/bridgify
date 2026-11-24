/**
 * Smart punctuation for live transcripts (report §3.3.2). Works per finished segment:
 * spoken commands become marks, questions get "?", other segments end with ".",
 * sentences are capitalised and stutters ("the the") collapse.
 */
const QUESTION_EN = /^(what|where|when|why|how|who|whom|whose|which|is|are|am|was|were|can|could|do|does|did|will|would|should|shall|may|might|have|has|kya|kahan|kab|kaun|kyun|kaise)\b/i
const QUESTION_HI = /^(क्या|कहाँ|कहां|कब|कौन|क्यों|कैसे|किसने|किसको)/
const COMMANDS: [RegExp, string][] = [
  [/\s*\b(full stop|period)\b/gi, '.'],
  [/\s*\bcomma\b/gi, ','],
  [/\s*\bquestion mark\b/gi, '?'],
  [/\s*\bexclamation (mark|point)\b/gi, '!'],
  [/\s*\bnew line\b\s*/gi, '\n'],
  [/\s*\bपूर्ण विराम\b/g, '।'],
]

export function punctuateSegment(raw: string, lang = 'en'): string {
  let t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  for (const [re, mark] of COMMANDS) t = t.replace(re, mark)
  t = t.replace(/\b(\w+)( \1\b)+/gi, '$1') // stutter collapse
  t = t.replace(/\bi\b/g, 'I')
  const hindi = lang.startsWith('hi') || /[ऀ-ॿ]/.test(t)
  if (!/[.?!।,\n]$/.test(t)) {
    const q = hindi ? QUESTION_HI.test(t) || / (क्या|न)$/.test(t) : QUESTION_EN.test(t)
    t += q ? '?' : hindi ? '।' : '.'
  }
  // Capitalise sentence starts (Latin script only).
  t = t.replace(/(^|[.?!]\s+|\n)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase())
  return t
}

export function joinSegments(segments: string[]): string {
  return segments.filter(Boolean).join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n')
}
