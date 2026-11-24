export type CameraError = 'denied' | 'not-found' | 'in-use' | 'insecure' | 'other'

export const CAMERA_MESSAGES: Record<CameraError, string> = {
  denied: 'Camera blocked. Click the camera icon in the address bar, choose Allow, then press Start camera again.',
  'not-found': 'No camera found. Connect one, or try another device.',
  'in-use': 'Another app is using the camera. Close it, then try again.',
  insecure: 'The camera only works on a secure (https) page.',
  other: 'The camera could not start. Reload the page and try again.',
}

export async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { code: 'insecure' as CameraError })
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
  } catch (e) {
    const name = (e as DOMException).name
    const code: CameraError = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'not-found' : name === 'NotReadableError' ? 'in-use' : 'other'
    throw Object.assign(new Error(code), { code })
  }
}
