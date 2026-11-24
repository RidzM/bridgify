import { MISSING, type DecodedPose } from './poseCompact'

export interface PoseColors { body: string; hands: string; face: string; joint: string; torso: string }

interface Layout { poseOff: number; poseN: number; faceOff: number; faceN: number; lhOff: number; rhOff: number; handLimbs: [number, number][]; box: [number, number, number, number] }
const layouts = new WeakMap<DecodedPose, Layout>()

/** Component offsets and a bounding box of the signing space over the whole animation. */
function layout(d: DecodedPose): Layout {
  const hit = layouts.get(d)
  if (hit) return hit
  let off = 0
  const L: Layout = { poseOff: -1, poseN: 0, faceOff: -1, faceN: 0, lhOff: -1, rhOff: -1, handLimbs: [], box: [0, 0, d.pose.w, d.pose.h] }
  for (const c of d.pose.components) {
    if (c.name.startsWith('POSE')) { L.poseOff = off; L.poseN = c.n }
    else if (c.name.startsWith('FACE')) { L.faceOff = off; L.faceN = c.n }
    else if (c.name.startsWith('LEFT_HAND')) { L.lhOff = off; L.handLimbs = c.limbs }
    else if (c.name.startsWith('RIGHT_HAND')) { L.rhOff = off; L.handLimbs = c.limbs }
    off += c.n
  }
  // Points that define the signing space: face, shoulders/elbows, hands (not hips).
  const use: number[] = []
  if (L.faceOff >= 0) for (let i = 0; i < L.faceN; i++) use.push(L.faceOff + i)
  if (L.poseOff >= 0) for (const i of [0, 1, 2, 3]) if (i < L.poseN) use.push(L.poseOff + i)
  for (const h of [L.lhOff, L.rhOff]) if (h >= 0) for (let i = 0; i < 21; i++) use.push(h + i)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let f = 0; f < d.pose.frames; f++) {
    const b = f * d.P * 2
    for (const i of use) {
      const x = d.xy[b + i * 2]!; const y = d.xy[b + i * 2 + 1]!
      if (x === MISSING) continue
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  if (Number.isFinite(x0)) {
    const w = x1 - x0; const h = y1 - y0; const side = Math.max(w, h) * 1.18
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2 + h * 0.04
    L.box = [cx - side / 2, cy - side / 2, side, side]
  }
  layouts.set(d, L)
  return L
}

/** Draws one frame as a clear upper-body figure: torso, arms to the hands, detailed hands, face points. */
export function drawPoseFrame(ctx: CanvasRenderingContext2D, d: DecodedPose, frame: number, colors: PoseColors) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  ctx.clearRect(0, 0, W, H)
  const L = layout(d)
  const f = Math.max(0, Math.min(d.pose.frames - 1, frame))
  const base = f * d.P * 2
  const [bx, by, bs] = L.box
  const s = Math.min(W, H) / bs
  const X = (i: number) => (d.xy[base + i * 2]! - bx) * s
  const Y = (i: number) => (d.xy[base + i * 2 + 1]! - by) * s
  const ok = (i: number) => i >= 0 && d.xy[base + i * 2] !== MISSING
  const line = (a: number, b: number, width: number, color: string) => {
    if (!ok(a) || !ok(b)) return
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke()
  }
  const unit = Math.min(W, H) / 100

  // Torso: a soft shape under the shoulders anchors the figure.
  const P = L.poseOff
  if (P >= 0 && ok(P) && ok(P + 1)) {
    const lx = X(P), ly = Y(P), rx = X(P + 1), ry = Y(P + 1)
    const drop = Math.abs(lx - rx) * 0.9
    ctx.fillStyle = colors.torso
    ctx.beginPath()
    ctx.moveTo(lx, ly); ctx.lineTo(rx, ry)
    ctx.lineTo(rx + (rx < lx ? 4 : -4) * unit, ry + drop); ctx.lineTo(lx + (lx < rx ? 4 : -4) * unit, ly + drop)
    ctx.closePath(); ctx.fill()
    line(P, P + 1, 2.4 * unit, colors.body)
    // Arms: shoulder → elbow → the hand's own wrist (the pose wrist is often unreliable).
    line(P, P + 2, 2.4 * unit, colors.body)
    line(P + 1, P + 3, 2.4 * unit, colors.body)
    if (ok(L.lhOff)) line(P + 2, L.lhOff, 2.1 * unit, colors.body); else line(P + 2, P + 4, 2.1 * unit, colors.body)
    if (ok(L.rhOff)) line(P + 3, L.rhOff, 2.1 * unit, colors.body); else line(P + 3, P + 5, 2.1 * unit, colors.body)
  }
  // Face as fine dots (expression is part of the sign).
  if (L.faceOff >= 0) {
    ctx.fillStyle = colors.face
    for (let i = 0; i < L.faceN; i++) { const k = L.faceOff + i; if (ok(k)) { ctx.beginPath(); ctx.arc(X(k), Y(k), 0.55 * unit, 0, Math.PI * 2); ctx.fill() } }
  }
  // Hands on top, in the accent colour.
  for (const h of [L.lhOff, L.rhOff]) {
    if (h < 0 || !ok(h)) continue
    for (const [a, b] of L.handLimbs) line(h + a, h + b, 1.3 * unit, colors.hands)
    ctx.fillStyle = colors.joint
    for (let i = 0; i < 21; i++) if (ok(h + i)) { ctx.beginPath(); ctx.arc(X(h + i), Y(h + i), (i % 4 === 0 && i ? 1.1 : 0.8) * unit, 0, Math.PI * 2); ctx.fill() }
  }
}
