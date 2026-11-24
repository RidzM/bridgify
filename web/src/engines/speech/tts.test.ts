import { describe, expect, it } from 'vitest'
import { chunkText, wordSpans } from './chunk'
import { levelToRate } from './tts'
import { rankVoices } from './voices'

describe('tts helpers', () => {
  it('maps the 1–10 speed slider to 0.5–2.0', () => {
    expect(levelToRate(1)).toBe(0.5)
    expect(levelToRate(10)).toBe(2)
    expect(levelToRate(5)).toBeCloseTo(1.17, 2)
  })
  it('chunks by sentence and caps long sentences', () => {
    const c = chunkText('Hello there. How are you? ' + 'word '.repeat(60))
    expect(c[0]!.text.trim()).toBe('Hello there.')
    expect(c[1]!.start).toBe(13)
    expect(c.every((x) => x.text.length <= 180)).toBe(true)
  })
  it('splits Hindi on the danda', () => {
    expect(chunkText('मुझे पानी चाहिए। धन्यवाद।').length).toBe(2)
  })
  it('finds word spans', () => {
    expect(wordSpans(' hi  there')).toEqual([[1, 3], [5, 10]])
  })
  it('ranks local exact-language voices first', () => {
    const v = (lang: string, localService: boolean, name: string) => ({ lang, localService, name, default: false, voiceURI: name }) as SpeechSynthesisVoice
    const r = rankVoices([v('en-US', false, 'net'), v('hi-IN', true, 'hi'), v('en-IN', true, 'local-in'), v('en-GB', true, 'gb')], 'en-IN')
    expect(r.map((x) => x.name)).toEqual(['local-in', 'gb', 'net'])
  })
})
