import type { ReactNode } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { VisionStatus } from '@/engines/vision/useVision'

interface Props {
  status: VisionStatus
  progress: number
  error: string | null
  onStart: () => void
  onStop: () => void
  sizeNote: string
  children: ReactNode
  stats?: { fps: number; inferMs: number; delegate: string }
}

/** Shared camera frame: start state, download progress, errors, live view, and stop. */
export function CameraShell({ status, progress, error, onStart, onStop, sizeNote, children, stats }: Props) {
  const active = status === 'running' || status === 'downloading' || status === 'starting'
  return (
    <div className="flex flex-col gap-3">
      <div className={active ? '' : 'hidden'}>{children}</div>
      {!active && (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 rounded-[12px] bg-bg p-6 text-center">
          <Camera aria-hidden size={32} strokeWidth={1.5} className="text-ink-muted" />
          <p className="max-w-[36ch] text-ink-muted">{error ?? 'Your camera stays on this device. Nothing is recorded or uploaded.'}</p>
          <Button variant="primary" size="lg" onClick={onStart}>{error ? 'Try again' : 'Start camera'}</Button>
          <p className="text-[0.8125rem] text-ink-muted">{sizeNote}</p>
        </div>
      )}
      {status === 'downloading' && (
        <div role="progressbar" aria-label="Loading the recognition model" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full origin-left bg-brand transition-transform duration-200" style={{ transform: `scaleX(${progress})` }} /></div>
          <p className="mt-1 text-[0.8125rem] text-ink-muted tabular">Loading the model, {Math.round(progress * 100)}%. Only needed once.</p>
        </div>
      )}
      {status === 'running' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.8125rem] text-ink-muted tabular">{stats ? `${stats.fps} fps · ${stats.inferMs} ms per frame · ${stats.delegate}` : ''}</p>
          <Button variant="quiet" onClick={onStop} icon={<CameraOff aria-hidden size={16} />}>Stop camera</Button>
        </div>
      )}
    </div>
  )
}
