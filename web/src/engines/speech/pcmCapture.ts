/** Captures microphone audio as 16 kHz mono Float32 chunks (for on-device Whisper). */
const WORKLET = `
class Collect extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true }
}
registerProcessor('bridgify-collect', Collect)`

export interface PcmCapture { stop: () => void }

export async function startPcmCapture(onChunk: (pcm: Float32Array) => void, chunkSeconds = 5): Promise<PcmCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const ctx = new AudioContext({ sampleRate: 16000 })
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))
  await ctx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
  const src = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, 'bridgify-collect')
  const target = 16000 * chunkSeconds
  let parts: Float32Array[] = []
  let n = 0
  const flush = () => {
    if (!n) return
    const out = new Float32Array(n)
    let o = 0
    for (const p of parts) { out.set(p, o); o += p.length }
    parts = []; n = 0
    // Skip near-silent chunks so Whisper doesn't hallucinate on silence.
    let e = 0
    for (let i = 0; i < out.length; i++) e += out[i]! * out[i]!
    if (Math.sqrt(e / out.length) > 0.006) onChunk(out)
  }
  node.port.onmessage = (ev: MessageEvent<Float32Array>) => {
    parts.push(ev.data); n += ev.data.length
    if (n >= target) flush()
  }
  src.connect(node)
  return {
    stop: () => { flush(); node.disconnect(); src.disconnect(); stream.getTracks().forEach((t) => t.stop()); void ctx.close() },
  }
}
