import { useCallback, useEffect, useRef, useState } from 'react'
import { openCamera, CAMERA_MESSAGES, type CameraError } from './camera'
import { VisionClient } from './visionClient'
import type { VisionInit, VisionResult } from './types'

export type VisionStatus = 'idle' | 'starting' | 'downloading' | 'running' | 'error'

/** Camera + vision worker lifecycle for a page. Everything stops when the page unmounts. */
export function useVision(config: VisionInit, onResult: (r: VisionResult) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const client = useRef<VisionClient | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<VisionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ fps: 0, inferMs: 0, delegate: '' })
  const cb = useRef(onResult)
  cb.current = onResult
  const key = JSON.stringify(config)

  const stop = useCallback(() => {
    client.current?.stop(); client.current = null
    setStream((s) => { s?.getTracks().forEach((t) => t.stop()); return null })
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    setError(null); setStatus('starting'); setProgress(0)
    let s: MediaStream
    try { s = await openCamera() } catch (e) {
      setStatus('error'); setError(CAMERA_MESSAGES[((e as { code?: CameraError }).code ?? 'other')]); return
    }
    setStream(s)
    const c = new VisionClient()
    client.current = c
    c.onResult = (r, fps) => { setStats((st) => (st.fps === fps && Math.abs(st.inferMs - r.inferMs) < 2 ? st : { ...st, fps, inferMs: r.inferMs })); cb.current(r) }
    c.onError = (m) => { setError(`Recognition stopped: ${m}. Reload the page to try again.`); setStatus('error') }
    try {
      setStatus('downloading')
      const delegate = await c.init(JSON.parse(key) as VisionInit, (l, t) => setProgress(t ? l / t : 0))
      setStats((st) => ({ ...st, delegate }))
      const wait = () => new Promise<void>((res) => { const v = videoRef.current; if (v && v.readyState >= 2) res(); else setTimeout(() => void wait().then(res), 50) })
      await wait()
      c.start(videoRef.current!)
      setStatus('running')
    } catch (err) {
      console.error('[vision] init failed:', err)
      s.getTracks().forEach((t) => t.stop()); setStream(null)
      setStatus('error'); setError("The recognition model couldn't load. Check your connection, then press Start camera again.")
    }
  }, [key])

  // Restart with the new settings when the config changes mid-run (e.g. switching ASL ↔ ISL).
  const running = status === 'running'
  useEffect(() => { if (running) { stop(); void start() } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [stop])
  useEffect(() => {
    const onHide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [stop])

  return { videoRef, stream, status, error, progress, stats, start, stop, running }
}
