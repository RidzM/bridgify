/**
 * Vision worker: MediaPipe hand + face landmarks, then features and the letter classifier.
 * Runs off the main thread so the page stays responsive.
 */
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision'
import { createMlp, type Mlp, type MlpHeader } from '../engines/vision/mlp'
import { aslFeatures, islFeatures } from '../engines/vision/features'
import type { FromWorker, Hand, ToWorker, VisionInit } from '../engines/vision/types'

const scope = self as unknown as { postMessage(m: FromWorker, t?: Transferable[]): void; onmessage: ((e: MessageEvent<ToWorker>) => void) | null }
let hands: HandLandmarker | null = null
let face: FaceLandmarker | null = null
let mlp: Mlp | null = null
let emo: (Mlp & { names: string[] }) | null = null
let config: VisionInit = {}
let frameNo = 0
let lastTs = 0

let loaderUrl = ''
/**
 * MediaPipe clears self.ModuleFactory after building each task, and in a module worker its loader
 * import is cached, so a second task (or a CPU retry) would fail with "ModuleFactory not set".
 * Restore it from the loader module's default export before every task creation.
 */
async function restoreFactory() {
  const g = self as unknown as { ModuleFactory?: unknown }
  if (!g.ModuleFactory && loaderUrl) g.ModuleFactory = ((await import(/* @vite-ignore */ loaderUrl)) as { default: unknown }).default
}
async function create<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<[T, 'GPU' | 'CPU']> {
  try { await restoreFactory(); return [await make('GPU'), 'GPU'] } catch { await restoreFactory(); return [await make('CPU'), 'CPU'] }
}

scope.onmessage = async (e) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      config = msg.config
      const fileset = await FilesetResolver.forVisionTasks(new URL(msg.wasmBase, self.location.origin).href, true)
      loaderUrl = fileset.wasmLoaderPath
      let delegate: 'GPU' | 'CPU' = 'CPU'
      if (config.hands) {
        const buf = new Uint8Array(msg.models['hand_landmarker']!)
        ;[hands, delegate] = await create((d) => HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: buf, delegate: d },
          runningMode: 'VIDEO', numHands: config.hands!.numHands,
          minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        }))
        const id = config.hands.classifier
        if (id) {
          const header = JSON.parse(new TextDecoder().decode(msg.models[`${id}.json`]!)) as MlpHeader
          mlp = createMlp(header, new Float32Array(msg.models[`${id}.bin`]!))
        }
      }
      if (config.face) {
        const buf = new Uint8Array(msg.models['face_landmarker']!)
        ;[face, delegate] = await create((d) => FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: buf, delegate: d },
          runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
        }))
        if (msg.models['emotion.json'] && msg.models['emotion.bin']) {
          const header = JSON.parse(new TextDecoder().decode(msg.models['emotion.json'])) as MlpHeader & { featureNames: string[] }
          emo = Object.assign(createMlp(header, new Float32Array(msg.models['emotion.bin'])), { names: header.featureNames })
        }
      }
      scope.postMessage({ type: 'ready', delegate })
      return
    }
    if (msg.type === 'close') { hands?.close(); face?.close(); hands = face = null; return }
    if (msg.type === 'frame') {
      const t0 = performance.now()
      const bmp = msg.bitmap
      const ts = Math.max(msg.ts, lastTs + 1) // MediaPipe needs strictly increasing timestamps
      lastTs = ts
      const aspect = bmp.width / bmp.height
      const out: Hand[] = []
      let letter: { probs: Float32Array; labels: string[] } | undefined
      if (hands) {
        const r = hands.detectForVideo(bmp, ts)
        r.landmarks.forEach((lm, i) => {
          const cat = r.handedness[i]?.[0]
          out.push({ landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })), handedness: (cat?.categoryName === 'Left' ? 'Left' : 'Right'), score: cat?.score ?? 0 })
        })
        if (mlp && out.length) {
          const x = config.hands?.classifier === 'isl-letters' ? islFeatures(out, aspect) : aspectFirst(out, aspect)
          letter = { probs: mlp.predict(x), labels: mlp.header.labels }
        }
      }
      let blendshapes: { name: string; score: number }[] | undefined
      let emotion: { probs: Float32Array; labels: string[] } | undefined
      if (face && frameNo++ % 3 === 0) {
        const r = face.detectForVideo(bmp, ts)
        blendshapes = r.faceBlendshapes[0]?.categories.map((c) => ({ name: c.categoryName, score: c.score })) ?? []
        if (emo && blendshapes.length) {
          const byName = Object.fromEntries(blendshapes.map((b) => [b.name, b.score]))
          emotion = { probs: emo.predict(emo.names.map((n) => byName[n] ?? 0)), labels: emo.header.labels }
        }
      }
      bmp.close()
      scope.postMessage({ type: 'result', result: { ts, hands: out, letter, blendshapes, emotion, inferMs: Math.round((performance.now() - t0) * 10) / 10, aspect } })
    }
  } catch (err) {
    scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

function aspectFirst(hs: Hand[], aspect: number) {
  const best = hs.reduce((a, b) => (b.score > a.score ? b : a))
  return aslFeatures(best, aspect)
}
