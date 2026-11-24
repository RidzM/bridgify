/**
 * Small QR code encoder (byte mode, versions 1–10, error correction L/M/Q/H) for the Bridge
 * join link. Follows ISO/IEC 18004; structure after Project Nayuki's reference implementation
 * (MIT). Output is a module grid; qrPath() turns it into one SVG path.
 */
export type Ecc = 'L' | 'M' | 'Q' | 'H'
export interface Qr { version: number; size: number; mask: number; ecc: Ecc; modules: boolean[][] }

const ECC_INDEX: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 }
const FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 }
// Index = version (1–10); [0] unused.
const ECC_PER_BLOCK = [
  [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
]
const BLOCKS = [
  [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
]
const MAX_VERSION = 10

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}

const dataCodewords = (ver: number, e: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[e]![ver]! * BLOCKS[e]![ver]!

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0)
  r[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j]!, root)
      if (j + 1 < r.length) r[j]! ^= r[j + 1]!
    }
    root = gfMul(root, 0x02)
  }
  return r
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ r.shift()!
    r.push(0)
    divisor.forEach((coef, i) => { r[i]! ^= gfMul(coef, factor) })
  }
  return r
}

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
  const out = [6]
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos)
  return out
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

export function encodeQr(text: string, ecc: Ecc = 'M', forceMask?: number): Qr {
  const bytes = [...new TextEncoder().encode(text)]
  const e = ECC_INDEX[ecc]
  let version = 0
  for (let v = 1; v <= MAX_VERSION; v++) {
    const ccBits = v <= 9 ? 8 : 16
    if (4 + ccBits + bytes.length * 8 <= dataCodewords(v, e) * 8) { version = v; break }
  }
  if (!version) throw new Error('Text too long for a QR code here')
  const size = version * 4 + 17

  // Data bits: byte mode, count, data, terminator, pad to bytes, pad codewords.
  const bits: number[] = []
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(0b0100, 4)
  put(bytes.length, version <= 9 ? 8 : 16)
  for (const b of bytes) put(b, 8)
  const capacity = dataCodewords(version, e) * 8
  put(0, Math.min(4, capacity - bits.length))
  put(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  // Split into blocks, add Reed–Solomon error correction, interleave.
  const numBlocks = BLOCKS[e]![version]!
  const eccLen = ECC_PER_BLOCK[e]![version]!
  const rawCodewords = Math.floor(rawDataModules(version) / 8)
  const numShort = numBlocks - (rawCodewords % numBlocks)
  const shortLen = Math.floor(rawCodewords / numBlocks)
  const div = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecw = rsRemainder(dat, div)
    if (i < numShort) dat.push(0)
    blocks.push(dat.concat(ecw))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= numShort) codewords.push(b[i]!) })
  }

  // Function patterns.
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const isFn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFn = (x: number, y: number, dark: boolean) => { modules[y]![x] = dark; isFn[y]![x] = true }
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy))
      const x = cx + dx; const y = cy + dy
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4)
    }
  }
  const align = alignmentPositions(version, size)
  align.forEach((ay, i) => align.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))
  const drawFormat = (mask: number) => {
    const d = (FORMAT_BITS[ecc] << 3) | mask
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((d << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(b, i))
    setFn(8, 7, bit(b, 6)); setFn(8, 8, bit(b, 7)); setFn(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(b, i))
    setFn(8, size - 8, true)
  }
  drawFormat(0)
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3); const c = Math.floor(i / 3)
      setFn(a, c, bit(b, i)); setFn(c, a, bit(b, i))
    }
  }

  // Codewords in the zigzag order.
  let bi = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert
        if (!isFn[y]![x] && bi < codewords.length * 8) { modules[y]![x] = bit(codewords[bi >>> 3]!, 7 - (bi & 7)); bi++ }
      }
    }
  }

  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isFn[y]![x]) continue
      let inv: boolean
      switch (mask) {
        case 0: inv = (x + y) % 2 === 0; break
        case 1: inv = y % 2 === 0; break
        case 2: inv = x % 3 === 0; break
        case 3: inv = (x + y) % 3 === 0; break
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
        case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break
        case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
        default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
      }
      if (inv) modules[y]![x] = !modules[y]![x]
    }
  }

  let mask = forceMask ?? -1
  if (mask < 0) {
    let best = Infinity
    for (let m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m)
      const p = penalty(modules)
      if (p < best) { best = p; mask = m }
      applyMask(m)
    }
  }
  applyMask(mask)
  drawFormat(mask)
  return { version, size, mask, ecc, modules }
}

function penalty(m: boolean[][]): number {
  const size = m.length
  let score = 0
  const addHistory = (run: number, h: number[]) => { if (h[0] === 0) run += size; h.pop(); h.unshift(run) }
  const countFinder = (h: number[]) => {
    const n = h[1]!
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n
    return (core && h[0]! >= n * 4 && h[6]! >= n ? 1 : 0) + (core && h[6]! >= n * 4 && h[0]! >= n ? 1 : 0)
  }
  const terminate = (color: boolean, run: number, h: number[]) => {
    if (color) { addHistory(run, h); run = 0 }
    run += size
    addHistory(run, h)
    return countFinder(h)
  }
  for (const vertical of [false, true]) {
    for (let a = 0; a < size; a++) {
      let color = false; let run = 0
      const h = [0, 0, 0, 0, 0, 0, 0]
      for (let b = 0; b < size; b++) {
        const c = vertical ? m[b]![a]! : m[a]![b]!
        if (c === color) {
          run++
          if (run === 5) score += 3
          else if (run > 5) score++
        } else {
          addHistory(run, h)
          if (!color) score += countFinder(h) * 40
          color = c; run = 1
        }
      }
      score += terminate(color, run, h) * 40
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y]![x]
    if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3
  }
  let dark = 0
  for (const row of m) for (const c of row) if (c) dark++
  const total = size * size
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
  return score
}

/** One SVG path for all dark modules (runs merged per row), offset by a quiet zone. */
export function qrPath(qr: Qr, border = 4): string {
  let d = ''
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (!row[x]) { x++; continue }
      let run = 1
      while (row[x + run]) run++
      d += `M${x + border} ${y + border}h${run}v1h-${run}z`
      x += run
    }
  })
  return d
}
