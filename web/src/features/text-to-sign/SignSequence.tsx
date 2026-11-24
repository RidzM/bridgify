import { useEffect, useState } from 'react'
import type { SignLang } from '@/stores/prefs'
import { fetchCompact, planSigns, type SignPlan } from '@/engines/sign/sequence'
import { SignPlayer } from './SignPlayer'

export interface SignSequenceProps {
  text: string
  lang: SignLang
  autoPlay?: boolean
  compact?: boolean
  /** A stored animation for exactly this text (lesson phrases). Played directly; the text is planned only if it fails to load. */
  pose?: string | null
  /** The label shown for a stored animation. */
  poseLabel?: string
}

/** Self-contained sign rendering for a piece of text (used by SOS and Bridge). */
export function SignSequence({ text, lang, autoPlay = true, compact = true, pose, poseLabel }: SignSequenceProps) {
  const [plan, setPlan] = useState<SignPlan | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setPlan(null); setFailed(false)
    const run: Promise<SignPlan> = pose
      ? fetchCompact(pose).then(
          (c): SignPlan => ({ items: [{ kind: 'pose', label: (poseLabel ?? text).toUpperCase(), pose: c, source: 'lexicon' }], gloss: null, spelled: [] }),
          () => planSigns(text, lang),
        )
      : planSigns(text, lang)
    if (text.trim()) run.then((p) => { if (live) setPlan(p) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [text, lang, pose, poseLabel])
  if (!text.trim()) return null
  if (failed) return <p className="text-ink-muted">Signs couldn't load. Check your connection.</p>
  if (!plan) return <p className="text-ink-muted" role="status">Preparing signs…</p>
  return <SignPlayer items={plan.items} autoPlay={autoPlay} compact={compact} label={`Signs for: ${text}`} />
}
