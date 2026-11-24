/**
 * Minimal reader for the .pose binary format (pose-format v0.1 / v0.2), as returned by the
 * sign.mt API. No dependencies and no runtime code generation (CSP-safe).
 */
export interface PoseComponent { name: string; format: string; points: string[]; limbs: [number, number][] }
export interface PoseFile {
  version: number; width: number; height: number; depth: number
  components: PoseComponent[]
  fps: number; frames: number; people: number
  /** [frame][person][pointIndex][dim] flattened; dims = format.length - 1 (last char is confidence). */
  data: Float32Array
  confidence: Float32Array
  dims: number
  totalPoints: number
}

export function readPose(buf: ArrayBuffer): PoseFile {
  const dv = new DataView(buf)
  let o = 0
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v }
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v }
  const f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v }
  const dec = new TextDecoder()
  const str = () => { const n = u16(); const s = dec.decode(new Uint8Array(buf, o, n)); o += n; return s }

  const version = Math.round(f32() * 1000) / 1000
  const width = u16(); const height = u16(); const depth = u16()
  const nComp = u16()
  const components: PoseComponent[] = []
  for (let c = 0; c < nComp; c++) {
    const name = str(); const format = str()
    const nPoints = u16(); const nLimbs = u16(); const nColors = u16()
    const points: string[] = []
    for (let i = 0; i < nPoints; i++) points.push(str())
    const limbs: [number, number][] = []
    for (let i = 0; i < nLimbs; i++) limbs.push([u16(), u16()])
    o += nColors * 6
    components.push({ name, format, points, limbs })
  }
  let fps: number; let frames: number
  if (version === 0.1) { fps = u16(); frames = u16() }
  else if (version === 0.2) { fps = f32(); frames = u32() }
  else throw new Error(`Unsupported pose version ${version}`)
  const people = u16()
  const totalPoints = components.reduce((n, c) => n + c.points.length, 0)
  const dims = Math.max(...components.map((c) => c.format.length)) - 1
  const nData = frames * people * totalPoints * dims
  const data = new Float32Array(nData)
  for (let i = 0; i < nData; i++) data[i] = f32()
  const nConf = frames * people * totalPoints
  const confidence = new Float32Array(nConf)
  for (let i = 0; i < nConf; i++) confidence[i] = f32()
  return { version, width, height, depth, components, fps, frames, people, data, confidence, dims, totalPoints }
}
