/** Unicode braille helpers. A cell is U+2800 + bitmask (dot n -> bit n-1). */
export type Dot = 1 | 2 | 3 | 4 | 5 | 6
export interface Cell { char: string; dots: Dot[]; source?: string }

export function dotsToChar(dots: readonly number[]): string {
  let mask = 0
  for (const d of dots) mask |= 1 << (d - 1)
  return String.fromCodePoint(0x2800 + mask)
}

export function charToDots(ch: string): Dot[] {
  const cp = ch.codePointAt(0) ?? 0
  if (cp < 0x2800 || cp > 0x28ff) return []
  const mask = cp - 0x2800
  const out: Dot[] = []
  for (let i = 0; i < 6; i++) if (mask & (1 << i)) out.push((i + 1) as Dot)
  return out
}

export function isBraille(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  return cp >= 0x2800 && cp <= 0x28ff
}

export function toCells(unicode: string, sources: string[] = []): Cell[] {
  return [...unicode].map((char, i) => ({ char, dots: isBraille(char) ? charToDots(char) : [], source: sources[i] }))
}

export function describeCell(c: Cell): string {
  if (c.char === ' ' || c.char === '⠀') return 'space'
  if (!c.dots.length) return c.char
  return `dots ${c.dots.join(' ')}${c.source ? `, ${c.source}` : ''}`
}

/** North American ASCII braille (BRF) for embossers. */
const BRF = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)="
export function toBrf(unicode: string): string {
  return [...unicode]
    .map((ch) => {
      if (ch === '\n') return '\r\n'
      if (!isBraille(ch)) return ch
      const mask = (ch.codePointAt(0) ?? 0x2800) - 0x2800
      return BRF[mask & 0x3f] ?? ' '
    })
    .join('')
}
