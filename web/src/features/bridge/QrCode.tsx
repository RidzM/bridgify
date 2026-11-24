import { useMemo } from 'react'
import { encodeQr, qrPath } from '@/engines/bridge/qr'

/** Dark modules on white in every display mode: inverted codes don't scan on many phones. */
export function QrCode({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const { size, d } = useMemo(() => {
    const qr = encodeQr(value, 'M')
    return { size: qr.size + 8, d: qrPath(qr, 4) }
  }, [value])
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={`block rounded-[10px] bg-white ${className}`} shapeRendering="crispEdges">
      <path d={d} fill="#000" />
    </svg>
  )
}
