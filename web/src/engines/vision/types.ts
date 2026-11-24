export interface Landmark { x: number; y: number; z: number }
export interface Hand { landmarks: Landmark[]; handedness: 'Left' | 'Right'; score: number }
export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'fearful' | 'disgusted' | 'neutral'
export type GestureName = 'thumbs_up' | 'thumbs_down' | 'open_palm' | 'pointing' | 'peace' | 'fist' | 'ily' | 'none'

export interface VisionInit {
  hands?: { numHands: 1 | 2; classifier?: 'asl-letters' | 'isl-letters' | null }
  face?: boolean
}
export type ToWorker =
  | { type: 'init'; config: VisionInit; models: Record<string, ArrayBuffer>; wasmBase: string }
  | { type: 'frame'; bitmap: ImageBitmap; ts: number }
  | { type: 'close' }

export interface VisionResult {
  ts: number
  hands: Hand[]
  letter?: { probs: Float32Array; labels: string[] }
  blendshapes?: { name: string; score: number }[]
  emotion?: { probs: Float32Array; labels: string[] }
  inferMs: number
  aspect: number
}
export type FromWorker =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'result'; result: VisionResult }
  | { type: 'error'; message: string }
