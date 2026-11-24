/**
 * Perkins-style chorded entry: S D F J K L = dots 3 2 1 4 5 6. A cell is committed when the
 * last held key is released, so all dots pressed together form one cell.
 */
export const KEY_TO_DOT: Record<string, number> = { KeyF: 1, KeyD: 2, KeyS: 3, KeyJ: 4, KeyK: 5, KeyL: 6 }

export class PerkinsChord {
  private down = new Set<string>()
  private chord = new Set<number>()

  /** Returns true if the key belongs to the brailler (so the caller can preventDefault). */
  keyDown(code: string, repeat = false): boolean {
    const dot = KEY_TO_DOT[code]
    if (dot === undefined) return false
    if (!repeat) { this.down.add(code); this.chord.add(dot) }
    return true
  }

  /** Returns the finished cell's dots when the last key is released, else null. */
  keyUp(code: string): number[] | null {
    if (KEY_TO_DOT[code] === undefined) return null
    this.down.delete(code)
    if (this.down.size === 0 && this.chord.size) {
      const out = [...this.chord].sort((a, b) => a - b)
      this.chord.clear()
      return out
    }
    return null
  }

  get pending(): number[] { return [...this.chord].sort((a, b) => a - b) }
  reset() { this.down.clear(); this.chord.clear() }
}
