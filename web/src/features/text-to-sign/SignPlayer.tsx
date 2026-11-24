import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react'
import { decodePose, type DecodedPose } from '@/engines/sign/poseCompact'
import { drawPoseFrame } from '@/engines/sign/renderPose'
import type { SignItem } from '@/engines/sign/sequence'
import { LetterGlyph } from '@/components/tool/LetterGlyph'

const KIND_LABEL: Record<SignItem['kind'], string> = { pose: 'Animation', video: 'Signer video', letter: 'Fingerspelling' }
const LETTER_MS = 900

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

interface Props { items: SignItem[]; autoPlay?: boolean; compact?: boolean; label?: string }

/** Plays a sign sequence: pose animations on a canvas, signer videos, or fingerspelling cards. */
export function SignPlayer({ items, autoPlay = true, compact = false, label = 'Sign player' }: Props) {
  const motionOff = typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off'
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(autoPlay && !motionOff && items.length > 0)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const frame = useRef(0)
  const decoded = useMemo(() => items.map((it) => (it.kind === 'pose' ? decodePose(it.pose) : null)), [items])
  const item = items[index]

  useEffect(() => { setIndex(0); frame.current = 0; setPlaying(autoPlay && !motionOff && items.length > 0) }, [items, autoPlay, motionOff])

  const next = () => {
    frame.current = 0
    if (index < items.length - 1) setIndex(index + 1)
    else if (loop) setIndex(0)
    else { setPlaying(false); setIndex(0) }
  }

  // Draw / animate pose frames.
  useEffect(() => {
    const d: DecodedPose | null | undefined = decoded[index]
    const c = canvas.current
    if (!d || !c) return
    const ctx = c.getContext('2d')!
    const colors = { body: cssVar('--ink-muted', '#595363'), hands: cssVar('--brand', '#3d0075'), face: cssVar('--ink-muted', '#595363'), joint: cssVar('--ink', '#18131f'), torso: cssVar('--surface-2', '#efedf3') }
    drawPoseFrame(ctx, d, frame.current, colors)
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = frame.current
    const tick = (now: number) => {
      acc += ((now - last) / 1000) * d.pose.fps * speed
      last = now
      const f = Math.floor(acc)
      if (f >= d.pose.frames) { frame.current = 0; next(); return }
      frame.current = f
      drawPoseFrame(ctx, d, f, colors)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [decoded, index, playing, speed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Letter cards advance on a timer; videos on "ended".
  useEffect(() => {
    if (!playing || item?.kind !== 'letter') return
    const t = setTimeout(next, LETTER_MS / speed)
    return () => clearTimeout(t)
  }, [playing, index, item, speed]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = video.current
    if (!v || item?.kind !== 'video') return
    v.playbackRate = speed
    if (playing) void v.play().catch(() => setPlaying(false)); else v.pause()
  }, [playing, item, speed])

  if (!items.length) return null
  const size = compact ? 'max-w-[220px]' : 'max-w-[420px]'

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={label}>
      <div className={`relative mx-auto aspect-square w-full ${size} overflow-hidden rounded-[12px] bg-bg`}>
        {item?.kind === 'pose' && <canvas ref={canvas} width={480} height={480} className="h-full w-full" aria-label={`Sign for ${item.label}`} role="img" />}
        {item?.kind === 'video' && (
          <video ref={video} key={item.src} src={item.src} poster={item.poster} muted playsInline className="h-full w-full object-contain" onEnded={next} aria-label={`Signer video for ${item.label}`} />
        )}
        {item?.kind === 'letter' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-ink">
            <LetterGlyph media={item.media} className="h-3/5 w-3/5" />
            <span className={`${item.media ? 'text-4xl' : 'text-7xl'} font-semibold`}>{item.label}</span>
            {item.motion && <span className="text-sm text-ink-muted">Moving letter</span>}
          </div>
        )}
      </div>
      <p className="text-center text-lg font-semibold" aria-live="polite">
        {item?.kind === 'letter' ? <>Fingerspelling <span className="text-ink-muted">{item.word.toUpperCase()}</span>: {item.label}</> : item?.label}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" className="press inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-surface-2 disabled:opacity-40" aria-label="Previous sign" disabled={index === 0} onClick={() => { frame.current = 0; setIndex(index - 1) }}><SkipBack aria-hidden size={18} /></button>
        <button type="button" className="press inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-[8px] bg-brand px-4 font-medium text-brand-ink" onClick={() => setPlaying(!playing)}>
          {playing ? <Pause aria-hidden size={18} /> : <Play aria-hidden size={18} />}{playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="press inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-surface-2 disabled:opacity-40" aria-label="Next sign" disabled={index >= items.length - 1} onClick={() => { frame.current = 0; setIndex(index + 1) }}><SkipForward aria-hidden size={18} /></button>
        {!compact && (
          <>
            <label className="ml-2 inline-flex min-h-11 items-center gap-2 text-[0.9375rem] text-ink-muted">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="min-h-10 rounded-[8px] border border-line bg-surface px-2 text-ink">
                <option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option>
              </select>
            </label>
            <button type="button" aria-pressed={loop} onClick={() => setLoop(!loop)} className={`press inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-3 text-[0.9375rem] ${loop ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-surface-2'}`}><Repeat aria-hidden size={16} /> Loop</button>
          </>
        )}
      </div>
      {!compact && items.length > 1 && (
        <ol className="flex flex-wrap gap-1.5" aria-label="Signs in this sequence">
          {items.map((it, i) => (
            <li key={i}>
              <button type="button" onClick={() => { frame.current = 0; setIndex(i) }} aria-current={i === index ? 'step' : undefined}
                className={`press min-h-10 rounded-[8px] border px-2.5 text-left text-[0.875rem] ${i === index ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-surface text-ink-muted hover:border-line-strong'}`}>
                <span className="font-medium text-ink">{it.label}</span>
                <span className="ml-1.5">{KIND_LABEL[it.kind]}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
