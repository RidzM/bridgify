import { describe, expect, it } from 'vitest'
import { PerkinsChord } from './perkins'

describe('perkins chording', () => {
  it('F+J makes dots 1 4 (letter c) on release of the last key', () => {
    const p = new PerkinsChord()
    p.keyDown('KeyF'); p.keyDown('KeyJ')
    expect(p.keyUp('KeyF')).toBeNull()
    expect(p.pending).toEqual([1, 4])
    expect(p.keyUp('KeyJ')).toEqual([1, 4])
  })
  it('ignores auto-repeat and non-brailler keys', () => {
    const p = new PerkinsChord()
    expect(p.keyDown('KeyA')).toBe(false)
    p.keyDown('KeyD'); p.keyDown('KeyD', true)
    expect(p.keyUp('KeyD')).toEqual([2])
  })
  it('all six keys make a full cell', () => {
    const p = new PerkinsChord()
    for (const k of ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL']) p.keyDown(k)
    let out: number[] | null = null
    for (const k of ['KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL']) out = p.keyUp(k) ?? out
    expect(out).toEqual([1, 2, 3, 4, 5, 6])
  })
})
