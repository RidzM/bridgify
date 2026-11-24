import { describe, expect, it, beforeEach } from 'vitest'
import { usePrefs, applyPrefsToDocument, motionOff, defaultPrefs } from './prefs'

describe('prefs store', () => {
  beforeEach(() => usePrefs.getState().reset())

  it('toggles tool visibility', () => {
    usePrefs.getState().toggleTool('gesture-emotion')
    expect(usePrefs.getState().hiddenTools).toEqual(['gesture-emotion'])
    usePrefs.getState().toggleTool('gesture-emotion')
    expect(usePrefs.getState().hiddenTools).toEqual([])
  })

  it('persists to localStorage under the versioned key', () => {
    usePrefs.getState().set('mode', 'dyslexia')
    const raw = JSON.parse(localStorage.getItem('bridgify.prefs.v1') ?? '{}')
    expect(raw.state.mode).toBe('dyslexia')
  })

  it('turns motion off in calm, focus and autism modes', () => {
    expect(motionOff('calm', 'system', false)).toBe(true)
    expect(motionOff('light', 'system', false)).toBe(false)
    expect(motionOff('light', 'system', true)).toBe(true)
    expect(motionOff('autism', 'on', false)).toBe(false)
  })

  it('applies mode and scale to the document', () => {
    applyPrefsToDocument({ ...defaultPrefs, mode: 'high-contrast', textScale: 1.5 })
    expect(document.documentElement.dataset.mode).toBe('high-contrast')
    expect(document.documentElement.style.getPropertyValue('--text-scale')).toBe('1.5')
  })
})
