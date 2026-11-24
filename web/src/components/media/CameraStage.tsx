import { useEffect, useRef, type ReactNode } from 'react'
import type { Hand } from '@/engines/vision/types'

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
]

interface Props {
  stream: MediaStream | null
  hands: Hand[]
  videoRef: React.RefObject<HTMLVideoElement>
  overlay?: ReactNode
  label: string
}

/** Mirrored camera preview with the tracked hand drawn on top. Frames sent to the model are not mirrored. */
export function CameraStage({ stream, hands, videoRef, overlay, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (v && stream && v.srcObject !== stream) { v.srcObject = stream; void v.play().catch(() => {}) }
  }, [stream, videoRef])

  useEffect(() => {
    const c = canvas.current
    const v = videoRef.current
    if (!c || !v) return
    const w = v.videoWidth || 640
    const h = v.videoHeight || 480
    if (c.width !== w) { c.width = w; c.height = h }
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    const style = getComputedStyle(document.documentElement)
    const live = style.getPropertyValue('--live-fill').trim() || '#c700c7'
    for (const hand of hands) {
      ctx.strokeStyle = live
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const [a, b] of BONES) {
        const p = hand.landmarks[a]!; const q = hand.landmarks[b]!
        ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke()
      }
      ctx.fillStyle = '#ffffff'
      for (const p of hand.landmarks) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3.5, 0, Math.PI * 2); ctx.fill() }
    }
  }, [hands, videoRef])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-ink">
      <video ref={videoRef} playsInline muted aria-label={label} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      {overlay}
    </div>
  )
}

/** Circular confidence/hold indicator. */
export function ConfidenceRing({ value, hold, label }: { value: number; hold: number; label: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-3 rounded-[12px] bg-ink/70 px-3 py-2 text-white backdrop-blur-sm">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--live-fill)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${c * hold} ${c}`} transform="rotate(-90 32 32)" />
        <text x="32" y="39" textAnchor="middle" fontSize="22" fontWeight="600" fill="white">{label}</text>
      </svg>
      <span className="text-[0.9375rem] tabular">{Math.round(value * 100)}%</span>
    </div>
  )
}
