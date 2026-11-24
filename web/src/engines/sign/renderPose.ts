import { MISSING, type DecodedPose } from './poseCompact.ts'

export interface PoseColors { body: string; hands: string; face: string; joint: string; torso: string }

interface Layout {
  poseOff: number; poseN: number; faceOff: number; faceN: number; lhOff: number; rhOff: number
  handLimbs: [number, number][]
  /** Square viewport (x, y, side) around the signing space over the whole animation, in pose pixels. */
  box: [number, number, number]
  /** Median shoulder width in pose pixels; sets arm lengths when the elbow is missing. */
  shoulder: number
}
const layouts = new WeakMap<DecodedPose, Layout>()

function layout(d: DecodedPose): Layout {
  const hit = layouts.get(d)
  if (hit) return hit
  let off = 0
  const L: Layout = { poseOff: -1, poseN: 0, faceOff: -1, faceN: 0, lhOff: -1, rhOff: -1, handLimbs: [], box: [0, 0, Math.max(d.pose.w, d.pose.h)], shoulder: 0 }
  for (const c of d.pose.components) {
    if (c.name.startsWith('POSE')) { L.poseOff = off; L.poseN = c.n }
    else if (c.name.startsWith('FACE')) { L.faceOff = off; L.faceN = c.n }
    else if (c.name.startsWith('LEFT_HAND')) { L.lhOff = off; L.handLimbs = c.limbs }
    else if (c.name.startsWith('RIGHT_HAND')) { L.rhOff = off; L.handLimbs = c.limbs }
    off += c.n
  }
  // The signing space: face, shoulders, elbows and hands (hips sit outside the frame).
  const use: number[] = []
  if (L.faceOff >= 0) for (let i = 0; i < L.faceN; i++) use.push(L.faceOff + i)
  if (L.poseOff >= 0) for (const i of [0, 1, 2, 3]) if (i < L.poseN) use.push(L.poseOff + i)
  for (const h of [L.lhOff, L.rhOff]) if (h >= 0) for (let i = 0; i < 21; i++) use.push(h + i)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const widths: number[] = []
  for (let f = 0; f < d.pose.frames; f++) {
    const b = f * d.P * 2
    for (const i of use) {
      const x = d.xy[b + i * 2]!; const y = d.xy[b + i * 2 + 1]!
      if (x === MISSING) continue
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    if (L.poseOff >= 0) {
      const a = b + L.poseOff * 2
      if (d.xy[a] !== MISSING && d.xy[a + 2] !== MISSING) widths.push(Math.hypot(d.xy[a]! - d.xy[a + 2]!, d.xy[a + 1]! - d.xy[a + 3]!))
    }
  }
  widths.sort((a, b) => a - b)
  L.shoulder = widths.length ? widths[widths.length >> 1]! : 0
  if (Number.isFinite(x0)) {
    const w = x1 - x0; const h = y1 - y0; const side = Math.max(w, h) * 1.18
    L.box = [(x0 + x1) / 2 - side / 2, (y0 + y1) / 2 + h * 0.04 - side / 2, side]
  }
  layouts.set(d, L)
  return L
}

type Pt = { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Places an elbow between a shoulder and a hand for an arm with segment lengths a and b,
 * bending down and away from the body, the way arms rest when signing.
 */
export function solveElbow(s: Pt, h: Pt, a: number, b: number, outward: number): Pt {
  const d = dist(s, h)
  if (d < 1e-6) return { x: s.x + outward * a * 0.3, y: s.y + a }
  const ux = (h.x - s.x) / d, uy = (h.y - s.y) / d
  if (d >= a + b) return { x: s.x + ux * d * (a / (a + b)), y: s.y + uy * d * (a / (a + b)) }
  const along = Math.max(-a, Math.min(a, (a * a - b * b + d * d) / (2 * d)))
  const off = Math.sqrt(Math.max(0, a * a - along * along))
  const n1 = { x: -uy, y: ux }
  const n2 = { x: uy, y: -ux }
  const score = (n: Pt) => n.y + 0.6 * outward * n.x
  const n = score(n1) >= score(n2) ? n1 : n2
  return { x: s.x + ux * along + n.x * off, y: s.y + uy * along + n.y * off }
}

/** Draws one frame as an upper-body figure: neck, torso, arms joined to the hands, face points and detailed hands. */
export function drawPoseFrame(ctx: CanvasRenderingContext2D, d: DecodedPose, frame: number, colors: PoseColors) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.clearRect(0, 0, W, H)
  const L = layout(d)
  const f = Math.max(0, Math.min(d.pose.frames - 1, frame))
  const base = f * d.P * 2
  const [bx, by, bs] = L.box
  const k = Math.min(W, H) / bs
  const ok = (i: number) => i >= 0 && d.xy[base + i * 2] !== MISSING
  const at = (i: number): Pt => ({ x: (d.xy[base + i * 2]! - bx) * k, y: (d.xy[base + i * 2 + 1]! - by) * k })
  const unit = Math.min(W, H) / 100
  const stroke = (pts: Pt[], width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(pts[0]!.x, pts[0]!.y)
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const P = L.poseOff
  const hands = [L.lhOff, L.rhOff].filter((h) => h >= 0 && ok(h))
  if (P >= 0 && ok(P) && ok(P + 1)) {
    const sL = at(P), sR = at(P + 1)
    const sw = Math.max(dist(sL, sR), L.shoulder * k * 0.6, 1)
    const midX = (sL.x + sR.x) / 2
    const upper = sw * 0.8, fore = sw * 0.72

    // Neck up to the chin, then the torso, both in the soft torso colour.
    let chin: Pt | null = null
    for (let i = 0; i < L.faceN; i++) { const q = L.faceOff + i; if (ok(q)) { const p = at(q); if (!chin || p.y > chin.y) chin = p } }
    ctx.fillStyle = colors.torso
    if (chin) stroke([{ x: midX, y: (sL.y + sR.y) / 2 }, { x: chin.x, y: chin.y - sw * 0.05 }], sw * 0.3, colors.torso)
    const inset = sw * 0.1, drop = sw * 1.15
    const dir = sR.x >= sL.x ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(sL.x, sL.y); ctx.lineTo(sR.x, sR.y)
    ctx.lineTo(sR.x - dir * inset, sR.y + drop); ctx.lineTo(sL.x + dir * inset, sL.y + drop)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = colors.torso; ctx.lineWidth = sw * 0.22; ctx.lineJoin = 'round'; ctx.stroke()

    // Join each visible hand to the arm it belongs to: nearest pose wrist, else elbow, else shoulder.
    const sides = [{ s: sL, e: P + 2, w: P + 4, out: -dir }, { s: sR, e: P + 3, w: P + 5, out: dir }]
    const anchor = (side: (typeof sides)[number]) => (ok(side.w) ? at(side.w) : ok(side.e) ? at(side.e) : side.s)
    const owner = new Map<number, number>() // side index -> hand offset
    if (hands.length === 2) {
      const [h0, h1] = hands as [number, number]
      const keep = dist(at(h0), anchor(sides[0]!)) + dist(at(h1), anchor(sides[1]!))
      const swap = dist(at(h1), anchor(sides[0]!)) + dist(at(h0), anchor(sides[1]!))
      owner.set(0, keep <= swap ? h0 : h1); owner.set(1, keep <= swap ? h1 : h0)
    } else if (hands.length === 1) {
      const h = hands[0]!
      owner.set(dist(at(h), anchor(sides[0]!)) <= dist(at(h), anchor(sides[1]!)) ? 0 : 1, h)
    }
    const armWidth = 2.3 * unit
    sides.forEach((side, i) => {
      const hand = owner.get(i)
      const end = hand !== undefined ? at(hand) : ok(side.w) ? at(side.w) : null
      if (!end) {
        // Resting arm: hangs down and slightly out, through the elbow when it is known.
        const e = ok(side.e) && dist(side.s, at(side.e)) < upper * 1.6 ? at(side.e) : { x: side.s.x + side.out * upper * 0.12, y: side.s.y + upper }
        const len = dist(side.s, e) || 1
        const tail = { x: e.x + ((e.x - side.s.x) / len) * fore, y: e.y + ((e.y - side.s.y) / len) * fore }
        stroke([side.s, e, tail], armWidth, colors.body)
        return
      }
      let elbow = ok(side.e) ? at(side.e) : null
      if (elbow) {
        const u = dist(side.s, elbow), v = dist(elbow, end)
        if (u < upper * 0.35 || u > upper * 1.7 || v < fore * 0.25 || v > fore * 1.9) elbow = null
      }
      stroke([side.s, elbow ?? solveElbow(side.s, end, upper, fore, side.out), end], armWidth, colors.body)
    })
  }

  // Face as fine dots (facial expression is part of many signs).
  if (L.faceOff >= 0) {
    ctx.fillStyle = colors.face
    for (let i = 0; i < L.faceN; i++) { const q = L.faceOff + i; if (ok(q)) { const p = at(q); ctx.beginPath(); ctx.arc(p.x, p.y, 0.55 * unit, 0, Math.PI * 2); ctx.fill() } }
  }
  // Hands on top, in the accent colour.
  for (const h of hands) {
    for (const [a, b] of L.handLimbs) if (ok(h + a) && ok(h + b)) stroke([at(h + a), at(h + b)], 1.3 * unit, colors.hands)
    ctx.fillStyle = colors.joint
    for (let i = 0; i < 21; i++) if (ok(h + i)) { const p = at(h + i); ctx.beginPath(); ctx.arc(p.x, p.y, (i % 4 === 0 && i ? 1.1 : 0.8) * unit, 0, Math.PI * 2); ctx.fill() }
  }
}
