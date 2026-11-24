import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Delete, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Switch } from '@/components/ui/Switch'
import { CameraStage, ConfidenceRing } from '@/components/media/CameraStage'
import { CameraShell } from '@/components/media/CameraShell'
import { useVision } from '@/engines/vision/useVision'
import { ProbSmoother } from '@/engines/vision/smoothing'
import { LetterCommitter } from '@/engines/vision/committer'
import { topK } from '@/engines/vision/mlp'
import type { Hand, VisionResult } from '@/engines/vision/types'
import { usePrefs, type SignLang } from '@/stores/prefs'

interface Props {
  onSend: (word: string) => void
  onSigning: (signing: boolean) => void
  showHands: boolean
  onShowHands: (v: boolean) => void
  onHands: (hands: readonly Hand[]) => void
  onHandsOff: () => void
}

const INTERACTIVE = 'input, textarea, select, button, a, [role="radio"], [role="switch"], [role="tab"], [contenteditable="true"]'

/** Fingerspell letters to the camera; Space or "Send word" sends the word. */
export function FingerspellSender(props: Props) {
  const signPref = usePrefs((s) => s.sign)
  const setPref = usePrefs((s) => s.set)
  const lang: SignLang = signPref.lang === 'asl' ? 'asl' : 'isl'
  const [hands, setHands] = useState<Hand[]>([])
  const [word, setWord] = useState('')
  const [view, setView] = useState<{ label: string | null; p: number; hold: number }>({ label: null, p: 0, hold: 0 })
  const smoother = useRef(new ProbSmoother())
  const committer = useRef(new LetterCommitter())
  const cb = useRef(props)
  useLayoutEffect(() => { cb.current = props })
  const signing = useRef(false)
  const lastHandAt = useRef(0)

  const onResult = (r: VisionResult) => {
    setHands(r.hands)
    const now = performance.now()
    if (cb.current.showHands) cb.current.onHands(r.hands)
    if (r.hands.length) {
      lastHandAt.current = now
      if (!signing.current) { signing.current = true; cb.current.onSigning(true) }
    } else if (signing.current && now - lastHandAt.current > 1500) { signing.current = false; cb.current.onSigning(false) }
    if (!r.letter || !r.hands.length) { committer.current.update(now, null); setView((v) => (v.label === null ? v : { label: null, p: 0, hold: 0 })); return }
    const best = topK(smoother.current.push(r.letter.probs), r.letter.labels, 1)[0]!
    const committed = committer.current.update(now, best)
    if (committed) setWord((w) => (w + committed).slice(0, 60))
    setView({ label: best.label, p: best.p, hold: committer.current.view(now, best).progress })
  }

  const v = useVision({ hands: { numHands: lang === 'isl' ? 2 : 1, classifier: lang === 'isl' ? 'isl-letters' : 'asl-letters' } }, onResult)
  useEffect(() => { smoother.current.reset(); committer.current.reset() }, [lang])
  useEffect(() => {
    if (v.running) return
    if (signing.current) { signing.current = false; cb.current.onSigning(false) }
    cb.current.onHandsOff()
  }, [v.running])
  useEffect(() => { if (!props.showHands) cb.current.onHandsOff() }, [props.showHands])
  useEffect(() => () => { cb.current.onSigning(false); cb.current.onHandsOff() }, [])

  const sendWord = () => {
    const w = word.trim().toLowerCase()
    if (!w) return
    cb.current.onSend(w)
    setWord('')
  }
  const sendRef = useRef(sendWord)
  useLayoutEffect(() => { sendRef.current = sendWord })

  // Space sends and Backspace deletes, unless focus is on a control that uses those keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.(INTERACTIVE)) return
      if (e.key === ' ') { e.preventDefault(); sendRef.current() }
      else if (e.key === 'Backspace') { e.preventDefault(); setWord((w) => w.slice(0, -1)) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Sign language</legend>
        {(['isl', 'asl'] as const).map((l) => (
          <Chip key={l} selected={lang === l} onClick={() => setPref('sign', { ...signPref, lang: l })}>{l.toUpperCase()}</Chip>
        ))}
      </fieldset>
      <div className="grid gap-4 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <CameraShell status={v.status} progress={v.progress} error={v.error} onStart={v.start} onStop={v.stop} stats={v.stats} sizeNote="First start downloads about 12 MB, then it works offline.">
          <CameraStage stream={v.stream} hands={hands} videoRef={v.videoRef} label="Your camera"
            overlay={v.running && view.label ? <div className="absolute left-3 top-3"><ConfidenceRing value={view.p} hold={view.hold} label={view.label} /></div> : null} />
        </CameraShell>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[0.875rem] font-medium text-ink-muted">Word so far</p>
            {word
              ? <p aria-live="polite" className="mt-1 min-h-12 break-words text-[2rem] font-semibold leading-tight tracking-[0.06em]">{word}</p>
              : <p aria-live="polite" className="mt-1 min-h-12 text-ink-muted">Letters you hold steady appear here.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={sendWord} disabled={!word.trim()} icon={<SendHorizontal aria-hidden size={18} />}>Send word</Button>
            <Button onClick={() => setWord((w) => w.slice(0, -1))} disabled={!word} aria-label="Delete last letter" icon={<Delete aria-hidden size={16} />} />
          </div>
          <p className="text-[0.8125rem] text-ink-muted">Space sends the word, Backspace deletes a letter.</p>
          <Switch label="Show my hands" hint="Sends only the outline of your hands, never video." checked={props.showHands} onChange={props.onShowHands} />
        </div>
      </div>
    </div>
  )
}
