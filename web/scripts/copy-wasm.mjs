// Copies MediaPipe's WebAssembly runtime into public/ so it is served from our own origin (offline-capable).
import { cpSync, mkdirSync, existsSync } from 'node:fs'
const src = 'node_modules/@mediapipe/tasks-vision/wasm'
const dst = 'public/wasm/mediapipe'
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true })
  for (const f of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) cpSync(`${src}/${f}`, `${dst}/${f}`)
  console.log('mediapipe wasm copied to', dst)
}
