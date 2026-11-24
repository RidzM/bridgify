/// <reference lib="webworker" />
// On-device Whisper (opt-in). Loaded only after the person agrees to the download.
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

env.allowLocalModels = false
let asr: AutomaticSpeechRecognitionPipeline | null = null

type In = { type: 'load' } | { type: 'transcribe'; id: number; audio: Float32Array }

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data
  try {
    if (msg.type === 'load') {
      // navigator.gpu can exist without a usable adapter; only use WebGPU if one is really there.
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
      const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null
      const device = adapter ? 'webgpu' : 'wasm'
      asr = (await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny.en', {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        progress_callback: (p: { status: string; loaded?: number; total?: number; file?: string }) => {
          if (p.status === 'progress') self.postMessage({ type: 'progress', loaded: p.loaded ?? 0, total: p.total ?? 0, file: p.file })
        },
      })) as AutomaticSpeechRecognitionPipeline
      self.postMessage({ type: 'ready', device })
    } else if (msg.type === 'transcribe') {
      if (!asr) throw new Error('Model not loaded')
      const t0 = performance.now()
      const out = (await asr(msg.audio)) as { text: string }
      self.postMessage({ type: 'text', id: msg.id, text: out.text.trim(), ms: Math.round(performance.now() - t0) })
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
