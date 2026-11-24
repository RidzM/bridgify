import { useEffect, useRef, useState } from 'react'
import type { BridgeSession } from '@/engines/bridge/session'
import type { RemoteHand } from '@/engines/bridge/landmarks'

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

function lerpHands(a: RemoteHand[] | null, b: RemoteHand[], k: number): RemoteHand[] {
  if (!a || a.length !== b.length || k >= 1) return b
  return b.map((h, i) => ({ left: h.left, points: h.points.map((p, j) => { const q = a[i]!.points[j]!; return { x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k } }) }))
}

/**
 * The other person's hands as a live outline ("show my hands"). Packets arrive at up to 15 Hz;
 * frames in between are interpolated so the outline moves smoothly (not with reduced motion).
 */
export function RemoteHands({ session, name }: { session: BridgeSession; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    let from: RemoteHand[] | null = null
    let target: RemoteHand[] | null = null
    let shown: RemoteHand[] | null = null
    let t0 = 0
    let dur = 80
    let lastAt = 0
    let raf = 0

    const paint = (hands: RemoteHand[] | null) => {
      const c = canvas.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(c.clientWidth * dpr)
      const h = Math.round(c.clientHeight * dpr)
      if (!w || !h) return
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      if (!hands) return
      const css = getComputedStyle(document.documentElement)
      ctx.strokeStyle = css.getPropertyValue('--live-fill').trim() || '#c700c7'
      ctx.fillStyle = css.getPropertyValue('--ink').trim() || '#18131f'
      ctx.lineWidth = 3.5 * dpr
      ctx.lineCap = 'round'
      for (const hand of hands) {
        for (const [a, b] of BONES) {
          const p = hand.points[a]!; const q = hand.points[b]!
          ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke()
        }
        for (const p of hand.points) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3.5 * dpr, 0, Math.PI * 2); ctx.fill() }
      }
    }

    const loop = () => {
      raf = 0
      if (!target) { paint(null); return }
      const reduced = document.documentElement.dataset.motion === 'off'
      const k = reduced ? 1 : Math.min(1, (performance.now() - t0) / dur)
      shown = lerpHands(from, target, k)
      paint(shown)
      if (k < 1) raf = requestAnimationFrame(loop)
    }

    const off = session.onHands((hands) => {
      const now = performance.now()
      if (!hands || !hands.length) { target = null; shown = null; setActive(false); if (!raf) raf = requestAnimationFrame(loop); return }
      from = shown
      target = hands
      t0 = now
      dur = Math.min(160, Math.max(40, now - lastAt))
      lastAt = now
      setActive(true)
      if (!raf) raf = requestAnimationFrame(loop)
    })
    const idle = setInterval(() => { if (target && performance.now() - lastAt > 2500) { target = null; shown = null; setActive(false); paint(null) } }, 1000)
    return () => { off(); clearInterval(idle); cancelAnimationFrame(raf) }
  }, [session])

  return (
    <figure className={active ? 'flex flex-col gap-2' : 'hidden'}>
      <canvas ref={canvas} role="img" aria-label={`Live outline of ${name}'s hands`} className="aspect-[4/3] w-full max-w-md rounded-[12px] bg-surface-2" />
      <figcaption className="text-[0.875rem] text-ink-muted">{name}'s hands, live. Only hand points are sent, never video.</figcaption>
    </figure>
  )
}
