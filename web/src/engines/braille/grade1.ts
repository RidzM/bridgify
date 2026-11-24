/**
 * Offline UEB Grade 1 (uncontracted) translator. Covers letters, capitals,
 * digits and common punctuation. The server (liblouis) is the reference;
 * tests keep this in agreement for the supported character set.
 */
import { dotsToChar, charToDots } from './cells'

const LETTER_DOTS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5],
  i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5], u: [1, 3, 6],
  v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
}
const DIGIT_LETTER = 'jabcdefghi' // 0..9 -> j,a..i
const PUNCT_DOTS: Record<string, number[]> = {
  ',': [2], '.': [2, 5, 6], '?': [2, 3, 6], '!': [2, 3, 5], "'": [3], '-': [3, 6], ':': [2, 5], ';': [2, 3],
  '/': [4, 5, 6, 3, 4], // handled specially below (two cells)
}
const CAP = dotsToChar([6])
const NUM = dotsToChar([3, 4, 5, 6])
const G1 = dotsToChar([5, 6])

export const LETTERS = Object.fromEntries(Object.entries(LETTER_DOTS).map(([k, v]) => [k, dotsToChar(v)]))

export interface Translation { unicode: string; sources: string[] }

const BLANK = '\u2800'
const CAP_TERM = dotsToChar([6]) + dotsToChar([3])
const isCapsWord = (w: string) => { const l = w.replace(/[^A-Za-z]/g, ''); return l.length >= 1 && l === l.toUpperCase() && /[A-Z]/.test(l) }

export function translateGrade1(text: string): Translation {
  const out: string[] = []
  const src: string[] = []
  const push = (cell: string, s: string) => { out.push(cell); src.push(s) }
  const tokens = text.normalize('NFC').split(/(\s+)/)
  // UEB capitals passage: 3+ consecutive all-caps words get one opening ⠠⠠⠠ and a closing ⠠⠄.
  const wordIdx = tokens.map((t, i) => (/^\s*$/.test(t) ? -1 : i)).filter((i) => i >= 0)
  const passage = new Set<number>()
  for (let a = 0; a < wordIdx.length; ) {
    let b = a
    while (b < wordIdx.length && isCapsWord(tokens[wordIdx[b]!]!) && tokens[wordIdx[b]!]!.replace(/[^A-Za-z]/g, '').length >= 1) b++
    if (b - a >= 3) for (let k = a; k < b; k++) passage.add(wordIdx[k]!)
    a = b === a ? a + 1 : b
  }
  tokens.forEach((word, ti) => {
    if (word === '') return
    if (/^\s+$/.test(word)) { for (const ch of word) push(ch === '\n' ? '\n' : BLANK, ch); return }
    const inPassage = passage.has(ti)
    const startPassage = inPassage && !passage.has(wordIdx[wordIdx.indexOf(ti) - 1] ?? -1)
    const endPassage = inPassage && !passage.has(wordIdx[wordIdx.indexOf(ti) + 1] ?? -1)
    const letters = word.replace(/[^A-Za-z]/g, '')
    const capsWord = !inPassage && letters.length >= 2 && letters === letters.toUpperCase()
    if (startPassage) { push(CAP, 'capital passage'); push(CAP, ''); push(CAP, '') }
    if (capsWord) { push(CAP, 'capital word'); push(CAP, '') }
    let inNumber = false
    for (const ch of word) {
      const lower = ch.toLowerCase()
      if (/[0-9]/.test(ch)) {
        if (!inNumber) { push(NUM, 'number'); inNumber = true }
        push(LETTERS[DIGIT_LETTER[Number(ch)]!]!, ch)
        continue
      }
      if (LETTERS[lower]) {
        if (inNumber && 'abcdefghij'.includes(lower)) push(G1, 'grade 1')
        inNumber = false
        if (!inPassage && !capsWord && ch !== lower) push(CAP, 'capital')
        push(LETTERS[lower]!, ch)
        continue
      }
      if (ch === '/') { push(dotsToChar([4, 5, 6]), '/'); push(dotsToChar([3, 4]), ''); inNumber = false; continue }
      const p = PUNCT_DOTS[ch]
      if (p) { if (ch !== '.' && ch !== ',') inNumber = false; push(dotsToChar(p), ch); continue }
      inNumber = false
      push(ch, ch)
    }
    if (endPassage) { push(CAP_TERM[0]!, 'end capitals'); push(CAP_TERM[1]!, '') }
  })
  return { unicode: out.join(''), sources: src }
}

/** Inverse of translateGrade1 for the supported set (offline Braille→Text). */
export function backTranslateGrade1(unicode: string): string {
  const byChar: Record<string, string> = Object.fromEntries(Object.entries(LETTERS).map(([k, v]) => [v, k]))
  const punct: Record<string, string> = Object.fromEntries(
    Object.entries(PUNCT_DOTS).filter(([k]) => k !== '/').map(([k, v]) => [dotsToChar(v), k]),
  )
  let out = ''
  let capNext = false
  let capWord = false
  let capPassage = false
  let number = false
  const cells = [...unicode]
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    if (c === ' ' || c === BLANK || c === '\n') { out += c === '\n' ? '\n' : ' '; if (!capPassage) capWord = false; number = false; continue }
    if (c === CAP && cells[i + 1] === CAP && cells[i + 2] === CAP) { capPassage = true; capWord = true; i += 2; continue }
    if (c === CAP && cells[i + 1] === CAP_TERM[1]) { capPassage = false; capWord = false; i++; continue }
    if (c === CAP) { if (cells[i + 1] === CAP) { capWord = true; i++ } else capNext = true; continue }
    if (c === NUM) { number = true; continue }
    if (c === G1) { number = false; continue }
    const letter = byChar[c]
    if (letter) {
      if (number && 'abcdefghij'.includes(letter)) { out += String(DIGIT_LETTER.indexOf(letter)); continue }
      number = false
      out += capWord || capNext ? letter.toUpperCase() : letter
      capNext = false
      continue
    }
    if (punct[c]) { out += punct[c]; continue }
    if (charToDots(c).length) { out += '?'; continue }
    out += c
  }
  return out
}
