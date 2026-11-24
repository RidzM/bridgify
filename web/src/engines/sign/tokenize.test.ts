import { describe, expect, it } from 'vitest'
import { tokenize } from './tokenize'

const e = (gloss: string, ...words: string[]) => ({ gloss, words, pose: null, video: null })
const lex = [e('THANK-YOU', 'thank you'), e('THANK', 'thank'), e('HELLO', 'hello', 'hi'), e('AU-REVOIR', 'au revoir')]

describe('tokenize', () => {
  it('prefers the longest phrase', () => {
    expect(tokenize('Thank you, hello!', lex).map((t) => t.entry?.gloss ?? t.text)).toEqual(['THANK-YOU', 'HELLO'])
  })
  it('keeps unknown words for fingerspelling', () => {
    expect(tokenize('hi Riddhi', lex).map((t) => t.entry?.gloss ?? `?${t.text}`)).toEqual(['HELLO', '?riddhi'])
  })
  it('matches multi-word foreign phrases', () => {
    expect(tokenize('AU REVOIR', lex)[0]!.entry?.gloss).toBe('AU-REVOIR')
  })
})
