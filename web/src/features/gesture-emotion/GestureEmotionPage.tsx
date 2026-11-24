import { useRef, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { CameraStage } from '@/components/media/CameraStage'
import { CameraShell } from '@/components/media/CameraShell'
import { useVision } from '@/engines/vision/useVision'
import { classifyGesture, type GestureParams } from '@/engines/vision/gestures'
import { WaveDetector } from '@/engines/vision/wave'
import { scoreEmotions, predictEmotion, drivers, EMOTIONS, type EmotionWeights } from '@/engines/vision/emotion'
import type { Emotion, Hand, VisionResult } from '@/engines/vision/types'
import { Speaker } from '@/engines/speech/tts'
import { downloadText } from '@/lib/download'
import meanings from '@content/phrases/gestures.json'
import thresholds from '@content/gesture-thresholds.json'
import weightsJson from '@content/emotion-weights.json'

type GestureKey = keyof typeof meanings
const speaker = new Speaker()
const params = ((thresholds as { params?: GestureParams }).params ?? thresholds) as GestureParams
const weights = ((weightsJson as { weights?: EmotionWeights }).weights ?? weightsJson) as EmotionWeights
const EMO_LABEL: Record<Emotion, string> = { neutral: 'Neutral', happy: 'Happy', surprised: 'Surprised', sad: 'Sad', angry: 'Angry', disgusted: 'Disgusted', fearful: 'Fearful' }
const PRETTY: Record<string, string> = { mouthSmile: 'smile', mouthFrown: 'frown', eyeWide: 'wide eyes', browDown: 'lowered brows', mouthPress: 'pressed lips', noseSneer: 'nose wrinkle', mouthUpperUp: 'raised upper lip', mouthStretch: 'stretched mouth', browInnerUp: 'raised inner brows', jawOpen: 'open jaw' }

interface LogRow { t: string; gesture: string; emotion: string; confidence: number }

export default function GestureEmotionPage() {
  const [hands, setHands] = useState<Hand[]>([])
  const [gesture, setGesture] = useState<GestureKey | null>(null)
  const [emotion, setEmotion] = useState<{ e: Emotion; conf: number; why: string[] } | null>(null)
  const [speak, setSpeak] = useState(false)
  const [log, setLog] = useState<LogRow[]>([])
  const wave = useRef(new WaveDetector())
  const held = useRef<{ g: string; since: number; logged: string; lostAt: number }>({ g: '', since: 0, logged: '', lostAt: 0 })
  const emoEma = useRef<Record<Emotion, number> | null>(null)

  const onResult = (r: VisionResult) => {
    setHands(r.hands)
    const now = performance.now()
    let g: GestureKey | null = null
    const h = r.hands[0]
    if (h) {
      const res = classifyGesture(h.landmarks, params, r.aspect)
      const waving = wave.current.push(now, h.landmarks[0]!.x, res.name === 'open_palm')
      g = waving ? 'wave' : res.name === 'none' ? null : (res.name as GestureKey)
    } else wave.current.push(now, null, false)
    setGesture(g)
    const H = held.current
    if (g && g !== H.g) { H.g = g; H.since = now }
    if (!g) { if (H.g) H.lostAt = now; H.g = '' ; if (now - H.lostAt > 1000) H.logged = '' }
    // Log (and optionally speak) once per gesture: when it has been held 0.8 s and differs from the last one.
    if (g && now - H.since > 800 && H.logged !== g) {
      H.logged = g
      setLog((l) => [{ t: new Date().toLocaleTimeString(), gesture: meanings[g].label, emotion: emotion ? EMO_LABEL[emotion.e] : '', confidence: emotion?.conf ?? 0 }, ...l].slice(0, 200))
      if (speak) speaker.speak(meanings[g].say, { lang: 'en-IN' })
    }
    if (r.blendshapes?.length) {
      const bs = Object.fromEntries(r.blendshapes.map((b) => [b.name, b.score]))
      // Probabilities from the trained model (held-out macro-F1 0.74); smoothed so the label doesn't flicker.
      const probs: Record<Emotion, number> = r.emotion
        ? (Object.fromEntries(r.emotion.labels.map((l, i) => [l, r.emotion!.probs[i]!])) as Record<Emotion, number>)
        : scoreEmotions(bs, weights)
      const prev = emoEma.current
      const next = Object.fromEntries(EMOTIONS.map((e) => [e, prev ? 0.4 * probs[e] + 0.6 * prev[e] : probs[e]])) as Record<Emotion, number>
      emoEma.current = next
      const e = predictEmotion(next)
      setEmotion({ e, conf: next[e], why: drivers(bs, weights, e).map((d) => PRETTY[d.name] ?? d.name) })
    } else if (r.blendshapes && !r.blendshapes.length) setEmotion(null)
  }

  const v = useVision({ hands: { numHands: 1, classifier: null }, face: true }, onResult)

  const exportCsv = () => downloadText('bridgify-gesture-log.csv', ['time,gesture,emotion,emotion_confidence', ...log.map((r) => `${r.t},${r.gesture},${r.emotion},${r.confidence.toFixed(2)}`)].join('\n'), 'text/csv')

  return (
    <ToolFrame title="Gesture and emotion" purpose="Show a hand gesture or a facial expression and see what it means." privacy={{ where: 'device', detail: 'Camera stays on this device' }}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel label="Camera" className="p-3 md:p-4">
          <CameraShell status={v.status} progress={v.progress} error={v.error} onStart={v.start} onStop={v.stop} stats={v.stats} sizeNote="First start downloads about 16 MB, then it works offline.">
            <CameraStage stream={v.stream} hands={hands} videoRef={v.videoRef} label="Camera preview" />
          </CameraShell>
        </Panel>
        <div className="flex flex-col gap-4">
          <Panel label="Gesture" className="p-5">
            <p className="text-[0.875rem] font-medium text-ink-muted">Gesture</p>
            <p aria-live="polite" className="mt-1 text-[1.75rem] font-semibold">{gesture ? meanings[gesture].label : <span className="text-[1rem] font-normal text-ink-muted">{v.running ? 'Show a gesture' : 'Start the camera'}</span>}</p>
            {gesture && <p className="text-lg text-ink-muted">{meanings[gesture].meaning}</p>}
            <div className="mt-3"><Switch label="Speak meanings aloud" hint="Says the meaning when you hold a gesture for a moment" checked={speak} onChange={setSpeak} /></div>
          </Panel>
          <Panel label="Emotion" className="p-5">
            <p className="text-[0.875rem] font-medium text-ink-muted">Expression (approximate)</p>
            {emotion ? (
              <>
                <p aria-live="polite" className="mt-1 text-[1.75rem] font-semibold">{EMO_LABEL[emotion.e]}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full origin-left bg-ok transition-transform duration-200" style={{ transform: `scaleX(${emotion.conf})` }} /></div>
                <p className="mt-2 text-[0.9375rem] text-ink-muted">{emotion.why.length ? `Based on: ${emotion.why.join(', ')}` : 'No strong expression'}</p>
              </>
            ) : <p className="mt-1 text-ink-muted">{v.running ? 'Face the camera' : 'Start the camera'}</p>}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel label="Session log" className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base">Session log</h2>
            <div className="flex gap-2">
              <Button variant="quiet" onClick={exportCsv} disabled={!log.length} icon={<Download aria-hidden size={16} />}>Export CSV</Button>
              <Button variant="quiet" onClick={() => setLog([])} disabled={!log.length} aria-label="Clear log" icon={<Trash2 aria-hidden size={16} />} />
            </div>
          </div>
          {log.length ? (
            <table className="w-full text-left text-[0.9375rem]">
              <thead><tr className="text-ink-muted"><th className="py-1 font-medium">Time</th><th className="font-medium">Gesture</th><th className="font-medium">Expression</th></tr></thead>
              <tbody>{log.slice(0, 12).map((r, i) => <tr key={i} className="border-t border-line"><td className="py-1.5 tabular">{r.t}</td><td>{r.gesture}</td><td>{r.emotion}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-ink-muted">Gestures you hold appear here. The log stays on this device.</p>}
        </Panel>
        <Panel label="Gesture guide" className="p-5">
          <h2 className="mb-3 text-base">What each gesture means</h2>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {(Object.keys(meanings) as GestureKey[]).map((k) => (
              <div key={k}><dt className="font-medium">{meanings[k].label}</dt><dd className="text-[0.9375rem] text-ink-muted">{meanings[k].meaning}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
    </ToolFrame>
  )
}
