// Generates docs/assets/banner.svg: an animated banner for the README (SMIL + CSS, no external files).
// Usage: node scripts/make-readme-banner.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { readPose } from '../src/engines/sign/poseFile.ts'
import { compactPose, decodePose, MISSING } from '../src/engines/sign/poseCompact.ts'
import { translateGrade1 } from '../src/engines/braille/grade1.ts'
import { charToDots } from '../src/engines/braille/cells.ts'

const INK = '#18131f', MUTED = '#595363', BG = '#f6f5f8', SURFACE = '#ffffff', LINE = '#e5e2ea', BRAND = '#3d0075', LIVE = '#c700c7', OK = '#0b6e69', STRONG = '#8a8396'

// --- signing figure from the real ASL "hello" pose ---
const b = readFileSync('src/engines/sign/__fixtures__/hello-ase.pose')
const d = decodePose(compactPose(readPose(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), 2, 0.05))
const comps = d.pose.components
let off = 0; const offs: Record<string, number> = {}
for (const c of comps) { offs[c.name] = off; off += c.n }
const hand = comps.find((c) => c.name === 'RIGHT_HAND_LANDMARKS')!
const P = offs['POSE_LANDMARKS']!, F = offs['FACE_LANDMARKS']!, LH = offs['LEFT_HAND_LANDMARKS']!, RH = offs['RIGHT_HAND_LANDMARKS']!
const BOX = { x: 20, y: 34, s: 250 } // where the figure sits inside its panel (px)
// bounding box over frames
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
for (let f = 0; f < d.pose.frames; f++) for (let i = 0; i < d.P; i++) {
  if (i >= P + 4 && i < F) continue // skip hips/wrists of the body
  const x = d.xy[(f * d.P + i) * 2]!, y = d.xy[(f * d.P + i) * 2 + 1]!
  if (x === MISSING) continue
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
}
const side = Math.max(x1 - x0, y1 - y0) * 1.1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
const tx = (x: number) => (BOX.x + ((x - cx) / side + 0.5) * BOX.s).toFixed(1)
const ty = (y: number) => (BOX.y + ((y - cy) / side + 0.5) * BOX.s).toFixed(1)
const pt = (f: number, i: number) => { const x = d.xy[(f * d.P + i) * 2]!, y = d.xy[(f * d.P + i) * 2 + 1]!; return x === MISSING ? null : [x, y] as const }
const frames = Array.from({ length: d.pose.frames }, (_, f) => f).filter((f) => f % 2 === 0)
const seg = (f: number, a: number, b2: number) => { const p = pt(f, a), q = pt(f, b2); return p && q ? `M${tx(p[0])} ${ty(p[1])}L${tx(q[0])} ${ty(q[1])}` : '' }
let lastBody = '', lastHands = ''
const bodyD = frames.map((f) => { const s = [seg(f, P, P + 1), seg(f, P, P + 2), seg(f, P + 1, P + 3), pt(f, LH) ? seg(f, P + 2, LH) : seg(f, P + 2, P + 4), pt(f, RH) ? seg(f, P + 3, RH) : seg(f, P + 3, P + 5)].join(''); if (s) lastBody = s; return s || lastBody || 'M0 0' })
const handsD = frames.map((f) => { const s = [LH, RH].map((h) => hand.limbs.map(([a, b2]) => seg(f, h + a, h + b2)).join('')).join(''); if (s) lastHands = s; return s || lastHands || 'M0 0' })
const dur = (frames.length / (d.pose.fps / 2)).toFixed(2)
const f0 = frames[Math.floor(frames.length / 2)]!
const faceDots = Array.from({ length: comps.find((c) => c.name === 'FACE_LANDMARKS')!.n }, (_, i) => pt(f0, F + i)).filter(Boolean).map((p) => `<circle cx="${tx(p![0])}" cy="${ty(p![1])}" r="1.2"/>`).join('')
// make paths have equal command counts per frame for smooth SMIL (fallback: discrete calcMode)
const figure = `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="${MUTED}" stroke-width="7" d="${bodyD[0]}"><animate attributeName="d" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" values="${bodyD.join(';')}"/></path>
    <path stroke="${BRAND}" stroke-width="3.2" d="${handsD[0]}"><animate attributeName="d" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" values="${handsD.join(';')}"/></path>
  </g>
  <g fill="${MUTED}" opacity=".55">${faceDots}</g>`

// --- braille row ---
const msg = 'Hello'
const cells = [...translateGrade1(msg).unicode]
const cellSvg = cells.map((ch, i) => {
  const dots = charToDots(ch)
  const x = i * 34
  return [1, 2, 3, 4, 5, 6].map((n) => {
    const col = n > 3 ? 1 : 0, row = (n - 1) % 3
    const cx2 = x + 8 + col * 13, cy2 = 8 + row * 13
    return dots.includes(n as never)
      ? `<circle class="r" style="animation-delay:${(i * 0.18 + n * 0.04).toFixed(2)}s" cx="${cx2}" cy="${cy2}" r="4.6" fill="${OK}"/>`
      : `<circle cx="${cx2}" cy="${cy2}" r="3.8" fill="none" stroke="${STRONG}" stroke-width="1.2"/>`
  }).join('')
}).join('')

const words = ['Hello,', 'how', 'can', 'I', 'help?']
const wordSvg = `<text x="0" y="22" class="sans" font-size="22" font-weight="500">${words.map((w, i) => `<tspan class="w" style="animation-delay:${(i * 0.55).toFixed(2)}s">${w}</tspan>`).join(' ')}</text>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 400" width="1280" height="400" role="img" aria-labelledby="t d">
<title id="t">Bridgify</title><desc id="d">One message, shown as speech, braille and sign. A signing figure says hello in ASL.</desc>
<style>
  .sans{font-family:'Atkinson Hyperlegible Next','Atkinson Hyperlegible','Segoe UI',Helvetica,Arial,sans-serif}
  .r{transform-box:fill-box;transform-origin:center;animation:raise 6s ease-out infinite}
  @keyframes raise{0%,4%{opacity:0;transform:scale(.2)}10%,92%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1)}}
  .w{fill:${INK};animation:hl 2.75s linear infinite}
  @keyframes hl{0%{fill:${INK}}2%,18%{fill:${LIVE}}20%,100%{fill:${INK}}}
  @media (prefers-reduced-motion:reduce){.r,.w{animation:none}}
</style>
<rect width="1280" height="400" rx="24" fill="${BG}"/>
<g transform="translate(72 98)">
  <g>
    <circle cx="11" cy="11" r="10" fill="${BRAND}"/><circle cx="11" cy="37" r="10" fill="${BRAND}"/>
    <circle cx="11" cy="63" r="8.5" fill="none" stroke="${STRONG}" stroke-width="2"/><circle cx="37" cy="11" r="8.5" fill="none" stroke="${STRONG}" stroke-width="2"/>
    <circle cx="37" cy="37" r="8.5" fill="none" stroke="${STRONG}" stroke-width="2"/><circle cx="37" cy="63" r="8.5" fill="none" stroke="${STRONG}" stroke-width="2"/>
  </g>
  <text x="68" y="58" class="sans" font-size="64" font-weight="600" fill="${INK}" letter-spacing="-1.5">Bridgify</text>
  <text x="0" y="132" class="sans" font-size="28" fill="${INK}">Speak your way. Be heard every way.</text>
  <text x="0" y="172" class="sans" font-size="20" fill="${MUTED}">Speech, text, braille and sign in one free browser app.</text>
  <text x="0" y="202" class="sans" font-size="20" fill="${MUTED}">Camera and microphone stay on your device.</text>
</g>
<g transform="translate(640 36)">
  <rect width="580" height="328" rx="16" fill="${SURFACE}" stroke="${LINE}"/>
  <line x1="290" y1="0" x2="290" y2="328" stroke="${LINE}"/>
  <clipPath id="fig"><rect x="1" y="1" width="288" height="326" rx="15"/></clipPath>
  <g clip-path="url(#fig)">${figure}</g>
  <text x="310" y="40" class="sans" font-size="14" fill="${MUTED}">Spoken</text>
  <g transform="translate(310 52)">${wordSvg}</g>
  <line x1="290" y1="104" x2="580" y2="104" stroke="${LINE}"/>
  <text x="310" y="132" class="sans" font-size="14" fill="${MUTED}">Braille</text>
  <g transform="translate(310 146)">${cellSvg}</g>
  <line x1="290" y1="208" x2="580" y2="208" stroke="${LINE}"/>
  <text x="310" y="236" class="sans" font-size="14" fill="${MUTED}">Signed, ASL</text>
  <text x="310" y="288" class="sans" font-size="40" font-weight="600" fill="${INK}" letter-spacing="-.5">HELLO</text>
</g>
</svg>`
writeFileSync('../docs/assets/banner.svg', svg)
console.log('banner.svg', (svg.length / 1024).toFixed(1), 'KB, frames', frames.length)
