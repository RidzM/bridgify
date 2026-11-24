import { lazy, Suspense } from 'react'
import type { SignSequenceProps } from '@/features/text-to-sign/SignSequence'

const SignSequence = lazy(() => import('@/features/text-to-sign/SignSequence').then((m) => ({ default: m.SignSequence })))

/** The sign player loads only when someone asks for signs, so the SOS page itself opens fast. */
export function LazySigns(props: SignSequenceProps) {
  return (
    <Suspense fallback={<p className="text-ink-muted" role="status">Preparing signs…</p>}>
      <SignSequence {...props} />
    </Suspense>
  )
}
