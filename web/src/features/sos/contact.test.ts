import { describe, expect, it } from 'vitest'
import { mapsLink, parseContact, speakableNumber } from './contact'
import sos from '@content/phrases/sos.json'
import { translateGrade1 } from '@/engines/braille/grade1'

describe('SOS contact', () => {
  it('finds the number and the name in free text', () => {
    expect(parseContact('Amma, +91 98765 43210')).toEqual({ label: 'Amma', tel: '+919876543210', number: '+91 98765 43210' })
    expect(parseContact('98765-43210 (Dad)')).toMatchObject({ label: 'Dad', tel: '9876543210' })
    expect(parseContact('Amma (98765 43210)')).toMatchObject({ label: 'Amma', tel: '9876543210' })
    expect(parseContact('112')).toMatchObject({ label: '112', tel: '112' })
    expect(parseContact('Riya')).toEqual({ label: 'Riya', tel: null, number: null })
    expect(parseContact('')).toEqual({ label: '', tel: null, number: null })
  })
  it('reads phone numbers digit by digit', () => {
    expect(speakableNumber('+91 98765 43210')).toBe('plus 9 1, 9 8 7 6 5, 4 3 2 1 0')
  })
  it('makes a maps link with 5 decimals', () => {
    expect(mapsLink(19.0760123, 72.8777456)).toBe('https://maps.google.com/?q=19.07601,72.87775')
  })
})

describe('SOS presets', () => {
  it('have text, Hindi and offline braille for every card', () => {
    expect(sos.presets.length).toBeGreaterThanOrEqual(6)
    for (const p of sos.presets) {
      expect(p.text.length).toBeGreaterThan(5)
      expect(p.hi).toMatch(/[ऀ-ॿ]/)
      expect(translateGrade1(p.text).unicode).toMatch(/^[⠀-⣿]+$/)
    }
  })
})
