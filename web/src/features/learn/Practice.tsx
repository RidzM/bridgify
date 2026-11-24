import { useEffect, useMemo, useRef, useState } from 'react'
import { ensureModel } from '@/engines/platform/modelManager'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CameraStage, ConfidenceRing } from '@/components/media/CameraStage'
import { CameraShell } from '@/components/media/CameraShell'
import { LetterGlyph } from '@/components/tool/LetterGlyph'
import { useVision } from '@/engines/vision/useVision'
import { ProbSmoother } from '@/engines/vision/smoothing'
import { LetterCommitter } from '@/engines/vision/committer'
import { topK } from '@/engines/vision/mlp'
import type { Hand, VisionResult } from '@/engines/vision/types'
import type { LetterItem } from '@/engines/sign/content'

/** Sign the shown letter to the camera; it is marked right once the recogniser commits it. */
export function Practice({ lang, letters }: { lang: 'asl' | 'isl'; letters: LetterItem[] }) {
  // Only ask for letters the recogniser was trained on (e.g. ISL has no H, J or Y yet).
  const [known, setKnown] = useState<Set<string> | null>(null)
  useEffect(() => {
    void ensureModel(`${lang}-letters`, 'json')
      .then((buf) => (JSON.parse(new TextDecoder().decode(buf)) as { labels: string[] }).labels)
      .then((labels) => setKnown(new Set(labels)))
      .catch(() => setKnown(null)) // unknown: offer every static letter
  }, [lang])
  const pool = useMemo(() => letters.filter((l) => !l.motion && l.letter && l.letter.length === 1 && (!known || known.has(l.letter))), [letters, known])
  const pickNext = (not?: string) => { const o = pool.filter((l) => l.letter !== not); return o[Math.floor(Math.random() * o.length)] ?? pool[0] }
  const [target, setTarget] = useState(() => pickNext())
  const [hands, setHands] = useState<Hand[]>([])
  const [ring, setRing] = useState({ label: '', p: 0, hold: 0 })
  const [score, setScore] = useState({ right: 0, tries: 0 })
  const [done, setDone] = useState(false)
  const smoother = useRef(new ProbSmoother())
  const committer = useRef(new LetterCommitter())
  const targetRef = useRef(target)
  targetRef.current = target
  useEffect(() => { if (pool.length && (!target || !pool.some((l) => l.letter === target.letter))) setTarget(pickNext()) }, [pool]) // eslint-disable-line react-hooks/exhaustive-deps

  const onResult = (r: VisionResult) => {
    setHands(r.hands)
    const now = performance.now()
    if (!r.letter || !r.hands.length) { committer.current.update(now, null); return }
    const top = topK(smoother.current.push(r.letter.probs), r.letter.labels, 1)[0]!
    const c = committer.current.update(now, top)
    setRing({ label: top.label, p: top.p, hold: committer.current.view(now, top).progress })
    if (c) {
      setScore((s) => ({ right: s.right + (c === targetRef.current?.letter ? 1 : 0), tries: s.tries + 1 }))
      if (c === targetRef.current?.letter) setDone(true)
    }
  }
  const v = useVision({ hands: { numHands: lang === 'isl' ? 2 : 1, classifier: lang === 'isl' ? 'isl-letters' : 'asl-letters' } }, onResult)
  if (!pool.length || !target) return <p className="text-ink-muted">Practice needs the letter pictures, which are still loading.</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col items-center gap-3 rounded-[16px] border border-line bg-surface p-5 text-center">
        <p className="text-ink-muted">Sign this letter</p>
        <p className="text-7xl font-semibold" aria-live="polite">{target.letter}</p>
        <LetterGlyph media={target.media} className="h-40 w-40" alt={`How to sign ${target.letter}`} />
        {target.tip && <p className="max-w-[36ch] text-[0.9375rem] text-ink-muted">{target.tip}</p>}
        {done ? (
          <div className="flex flex-col items-center gap-2">
            <p className="flex items-center gap-2 text-lg font-semibold text-ok"><Check aria-hidden /> Well done</p>
            <Button variant="primary" onClick={() => { setTarget(pickNext(target.letter)); setDone(false); committer.current.reset(); smoother.current.reset() }}>Next letter</Button>
          </div>
        ) : <Button variant="quiet" onClick={() => setTarget(pickNext(target.letter))}>Skip</Button>}
        <p className="text-[0.875rem] text-ink-muted tabular">{score.right} right of {score.tries} tries</p>
      </div>
      <div className="rounded-[16px] border border-line bg-surface p-3 md:p-4">
        <CameraShell status={v.status} progress={v.progress} error={v.error} onStart={v.start} onStop={v.stop} stats={v.stats} sizeNote="Uses the same on-device recogniser as Sign to text.">
          <CameraStage stream={v.stream} hands={hands} videoRef={v.videoRef} label="Camera preview"
            overlay={v.running && ring.label ? <div className="absolute left-3 top-3"><ConfidenceRing value={ring.p} hold={ring.hold} label={ring.label} /></div> : null} />
        </CameraShell>
      </div>
    </div>
  )
}
