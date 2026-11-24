import { useEffect, useState } from 'react'
import type { SignLang } from '@/stores/prefs'
import { planSigns, type SignPlan } from '@/engines/sign/sequence'
import { SignPlayer } from './SignPlayer'

export interface SignSequenceProps { text: string; lang: SignLang; autoPlay?: boolean; compact?: boolean }

/** Self-contained sign rendering for a piece of text (used by SOS and Bridge). */
export function SignSequence({ text, lang, autoPlay = true, compact = true }: SignSequenceProps) {
  const [plan, setPlan] = useState<SignPlan | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setPlan(null); setFailed(false)
    if (text.trim()) planSigns(text, lang).then((p) => { if (live) setPlan(p) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [text, lang])
  if (!text.trim()) return null
  if (failed) return <p className="text-ink-muted">Signs couldn't load. Check your connection.</p>
  if (!plan) return <p className="text-ink-muted" role="status">Preparing signs…</p>
  return <SignPlayer items={plan.items} autoPlay={autoPlay} compact={compact} label={`Signs for: ${text}`} />
}
