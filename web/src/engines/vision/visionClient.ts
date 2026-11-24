import { ensureModel } from '@/engines/platform/modelManager'
import type { FromWorker, VisionInit, VisionResult } from './types'

/**
 * Runs the vision worker against a <video>. Sends one frame at a time (back-pressure), so the
 * page never queues work and stays responsive.
 */
export class VisionClient {
  private worker: Worker | null = null
  private video: HTMLVideoElement | null = null
  private busy = false
  private running = false
  private rvfc = 0
  private frames: number[] = []
  onResult: (r: VisionResult, fps: number) => void = () => {}
  onError: (message: string) => void = () => {}

  async init(config: VisionInit, onProgress?: (loaded: number, total: number) => void): Promise<'GPU' | 'CPU'> {
    const ids: [string, string, string][] = [] // [key in worker, model id, file]
    if (config.hands) ids.push(['hand_landmarker', 'hand_landmarker', 'task'])
    if (config.face) ids.push(['face_landmarker', 'face_landmarker', 'task'], ['emotion.json', 'emotion', 'json'], ['emotion.bin', 'emotion', 'bin'])
    const cls = config.hands?.classifier
    if (cls) ids.push([`${cls}.json`, cls, 'json'], [`${cls}.bin`, cls, 'bin'])
    const totals = new Map<string, [number, number]>()
    const report = (id: string) => (l: number, t: number) => {
      totals.set(id, [l, t])
      let L = 0; let T = 0
      for (const [a, b] of totals.values()) { L += a; T += b }
      onProgress?.(L, T)
    }
    const buffers = await Promise.all(ids.map(([key, id, file]) => ensureModel(id, file, report(key))))
    const models: Record<string, ArrayBuffer> = {}
    ids.forEach(([key], i) => { models[key] = buffers[i]! })
    this.worker = new Worker(new URL('../../workers/vision.worker.ts', import.meta.url), { type: 'module' })
    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data
        if (m.type === 'ready') resolve(m.delegate)
        else if (m.type === 'error') { this.onError(m.message); reject(new Error(m.message)) }
        else if (m.type === 'result') {
          this.busy = false
          const now = performance.now()
          this.frames.push(now)
          while (this.frames.length && now - this.frames[0]! > 1000) this.frames.shift()
          this.onResult(m.result, this.frames.length)
        }
      }
      this.worker!.onerror = (e) => { this.onError(e.message || 'Vision worker failed'); reject(new Error(e.message)) }
      this.worker!.postMessage({ type: 'init', config, models, wasmBase: '/wasm/mediapipe' }, Object.values(models))
    })
  }

  start(video: HTMLVideoElement) {
    this.video = video
    this.running = true
    const tick = async () => {
      if (!this.running || !this.video) return
      if (!this.busy && this.video.readyState >= 2 && this.video.videoWidth) {
        this.busy = true
        try {
          const bitmap = await createImageBitmap(this.video)
          this.worker?.postMessage({ type: 'frame', bitmap, ts: performance.now() }, [bitmap])
        } catch { this.busy = false }
      }
      this.schedule(tick)
    }
    this.schedule(tick)
  }

  private schedule(fn: () => void) {
    const v = this.video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    if (v?.requestVideoFrameCallback) this.rvfc = v.requestVideoFrameCallback(fn)
    else this.rvfc = requestAnimationFrame(fn)
  }

  stop() {
    this.running = false
    const v = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null
    v?.cancelVideoFrameCallback?.(this.rvfc)
    cancelAnimationFrame(this.rvfc)
    this.worker?.postMessage({ type: 'close' })
    this.worker?.terminate()
    this.worker = null
    this.busy = false
  }
}
