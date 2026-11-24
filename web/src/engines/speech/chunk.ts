/** Splits text into sentence chunks no longer than max characters (Chrome cuts off long utterances). */
export interface Chunk { text: string; start: number }
export function chunkText(text: string, max = 180): Chunk[] {
  const out: Chunk[] = []
  const re = /[^.!?।\n]+[.!?।]*[\s\n]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    let piece = m[0]
    let start = m.index
    while (piece.length > max) {
      let cut = piece.lastIndexOf(' ', max)
      if (cut < max * 0.5) cut = max
      out.push({ text: piece.slice(0, cut), start })
      start += cut
      piece = piece.slice(cut)
    }
    if (piece.trim()) out.push({ text: piece, start })
  }
  return out
}

/** Word spans [start, end) within a string. */
export function wordSpans(text: string): [number, number][] {
  const spans: [number, number][] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) spans.push([m.index, m.index + m[0].length])
  return spans
}

/** Estimated ms per character at a given rate (used when the voice gives no word events). */
export const msPerChar = (rate: number) => 62 / rate
