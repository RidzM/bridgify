import { useEffect, useRef, useState } from 'react'
import { Space, Delete, Volume2, Copy, Trash2 } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { toast } from '@/components/ui/Toast'
import { CameraStage, ConfidenceRing } from '@/components/media/CameraStage'
import { CameraShell } from '@/components/media/CameraShell'
import { useVision } from '@/engines/vision/useVision'
import { ProbSmoother } from '@/engines/vision/smoothing'
import { LetterCommitter } from '@/engines/vision/committer'
import { topK } from '@/engines/vision/mlp'
import type { Hand, VisionResult } from '@/engines/vision/types'
import { Speaker } from '@/engines/speech/tts'
import { SIGN_LANGS } from '@/lib/signLangs'
import { usePrefs, type SignLang } from '@/stores/prefs'

const speaker = new Speaker()

export default function SignToTextPage() {
  const signPref = usePrefs((s) => s.sign)
  const setPref = usePrefs((s) => s.set)
  const lang: SignLang = signPref.lang === 'asl' ? 'asl' : 'isl'
  const [hands, setHands] = useState<Hand[]>([])
  const [text, setText] = useState('')
  const [view, setView] = useState<{ label: string | null; p: number; hold: number; top: { label: string; p: number }[] }>({ label: null, p: 0, hold: 0, top: [] })
  const [noHandFor, setNoHandFor] = useState(0)
  const smoother = useRef(new ProbSmoother())
  const committer = useRef(new LetterCommitter())
  const lastHand = useRef(performance.now())

  const onResult = (r: VisionResult) => {
    setHands(r.hands)
    const now = performance.now()
    if (r.hands.length) lastHand.current = now
    setNoHandFor(now - lastHand.current)
    if (!r.letter || !r.hands.length) { committer.current.update(now, null); setView((v) => (v.label === null && v.p === 0 ? v : { label: null, p: 0, hold: 0, top: [] })); return }
    const probs = smoother.current.push(r.letter.probs)
    const top = topK(probs, r.letter.labels, 3)
    const best = top[0]!
    const committed = committer.current.update(now, best)
    if (committed) setText((t) => t + committed)
    const cv = committer.current.view(now, best)
    setView({ label: best.label, p: best.p, hold: cv.progress, top })
  }

  const v = useVision({ hands: { numHands: lang === 'isl' ? 2 : 1, classifier: lang === 'isl' ? 'isl-letters' : 'asl-letters' } }, onResult)
  useEffect(() => { smoother.current.reset(); committer.current.reset() }, [lang])

  const unsure = v.running && hands.length > 0 && view.p < 0.8 && view.top.length > 0
  const add = (s: string) => setText((t) => t + s)

  return (
    <ToolFrame title="Sign to text" purpose="Fingerspell letters to the camera. Each letter counts once you hold it steady." privacy={{ where: 'device', detail: 'Camera stays on this device' }}>
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Sign language">
        {SIGN_LANGS.map((l) => (
          <Chip key={l.id} selected={lang === l.id} disabled={!l.recognition} onClick={() => setPref('sign', { lang: l.id })} title={l.recognition ? l.name : `${l.name}: camera recognition coming later. Use Text to sign or Tutorials.`}>
            {l.code}
          </Chip>
        ))}
        <span className="text-[0.875rem] text-ink-muted">FSL, LSM, LIS and DGS: use Text to sign and Tutorials for now.</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel label="Camera" className="p-3 md:p-4">
          <CameraShell status={v.status} progress={v.progress} error={v.error} onStart={v.start} onStop={v.stop} stats={v.stats}
            sizeNote="First start downloads about 12 MB, then it works offline.">
            <CameraStage stream={v.stream} hands={hands} videoRef={v.videoRef} label="Camera preview"
              overlay={
                <>
                  {v.running && view.label && (
                    <div className="absolute left-3 top-3"><ConfidenceRing value={view.p} hold={view.hold} label={view.label} /></div>
                  )}
                  {v.running && noHandFor > 3000 && (
                    <p className="absolute inset-x-3 bottom-3 rounded-[10px] bg-ink/75 px-3 py-2 text-center text-[0.9375rem] text-white">
                      Can't see your hand. Try more light and keep your hand inside the frame.
                    </p>
                  )}
                </>
              } />
          </CameraShell>
        </Panel>

        <Panel label="Detected text" className="flex flex-col gap-4 p-5">
          <p className="text-[0.875rem] font-medium text-ink-muted">Detected text</p>
          <p aria-live="polite" className="min-h-24 max-w-none break-words text-[2rem] font-semibold tracking-[0.04em]">
            {text || <span className="text-[1rem] font-normal tracking-normal text-ink-muted">Letters you sign appear here.</span>}
          </p>
          {unsure && (
            <div>
              <p className="mb-2 text-[0.9375rem] text-ink-muted">Not sure. Hold the shape still, or tap the right letter:</p>
              <div className="flex gap-2">{view.top.map((t) => <Chip key={t.label} onClick={() => add(t.label)}>{t.label} <span className="text-ink-muted tabular">{Math.round(t.p * 100)}%</span></Chip>)}</div>
            </div>
          )}
          <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={() => add(' ')} icon={<Space aria-hidden size={16} />}>Space</Button>
            <Button onClick={() => setText((t) => t.slice(0, -1))} disabled={!text} aria-label="Delete last letter" icon={<Delete aria-hidden size={16} />} />
            <Button onClick={() => speaker.speak(text.toLowerCase(), { lang: 'en-IN' })} disabled={!text.trim()} icon={<Volume2 aria-hidden size={16} />}>Speak</Button>
            <Button onClick={async () => { await navigator.clipboard.writeText(text); toast('Copied') }} disabled={!text} icon={<Copy aria-hidden size={16} />}>Copy</Button>
            <Button variant="quiet" onClick={() => { const b = text; setText(''); toast('Cleared', { label: 'Undo', run: () => setText(b) }) }} disabled={!text} icon={<Trash2 aria-hidden size={16} />}>Clear</Button>
          </div>
          <p className="text-[0.8125rem] text-ink-muted">J and Z use movement, so type them with the keyboard. This recognises fingerspelled letters only. It does not translate sign language and is not a substitute for an interpreter.</p>
        </Panel>
      </div>
    </ToolFrame>
  )
}
