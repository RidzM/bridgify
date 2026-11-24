/** Talks to the opt-in Whisper worker. The worker (and its ~40 MB model) is created only on demand. */
type Msg =
  | { type: 'progress'; loaded: number; total: number; file?: string }
  | { type: 'ready'; device: string }
  | { type: 'text'; id: number; text: string; ms: number }
  | { type: 'error'; message: string }

export class WhisperClient {
  private worker: Worker | null = null
  private seq = 0
  private pending = new Map<number, (t: string) => void>()
  onProgress: (fraction: number) => void = () => {}
  onError: (m: string) => void = () => {}

  load(): Promise<string> {
    if (!this.worker) this.worker = new Worker(new URL('../../workers/asr.worker.ts', import.meta.url), { type: 'module' })
    const files = new Map<string, [number, number]>()
    return new Promise((resolve, reject) => {
      this.worker!.onmessage = (e: MessageEvent<Msg>) => {
        const m = e.data
        if (m.type === 'progress') {
          files.set(m.file ?? '?', [m.loaded, m.total])
          let l = 0; let t = 0
          for (const [a, b] of files.values()) { l += a; t += b }
          this.onProgress(t ? l / t : 0)
        } else if (m.type === 'ready') resolve(m.device)
        else if (m.type === 'text') { this.pending.get(m.id)?.(m.text); this.pending.delete(m.id) }
        else if (m.type === 'error') { console.error('[whisper]', m.message); this.onError(m.message); reject(new Error(m.message)) }
      }
      this.worker!.postMessage({ type: 'load' })
    })
  }

  transcribe(audio: Float32Array): Promise<string> {
    const id = ++this.seq
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.worker?.postMessage({ type: 'transcribe', id, audio }, [audio.buffer])
    })
  }

  dispose() { this.worker?.terminate(); this.worker = null }
}
