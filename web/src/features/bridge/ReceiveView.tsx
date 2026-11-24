import { useEffect, useMemo, useState } from 'react'
import { DotGrid } from '@/components/tool/DotGrid'
import { toBraille } from '@/engines/braille/client'
import { translateGrade1 } from '@/engines/braille/grade1'
import { wordSpans } from '@/engines/speech/chunk'
import type { BrailleGrade, ReceiveMode } from '@/engines/bridge/packets'
import type { ChatMessage } from '@/engines/bridge/session'
import { SignSequence } from '@/features/text-to-sign/SignSequence'
import type { SignLang } from '@/stores/prefs'

interface Props {
  message: ChatMessage
  mode: ReceiveMode
  grade: BrailleGrade
  signLang: SignLang
  /** Speech mode: which message is being read and the character being spoken. */
  speakingId: string | null
  charAt: number
}

const LARGE = 'max-w-none break-words font-medium leading-[1.15] tracking-[-0.01em] text-ink text-[clamp(2rem,1.3rem+2.4vw,3.25rem)]'

/** The newest message from the other person, shown the way this person chose to receive it. */
export function ReceiveView({ message, mode, grade, signLang, speakingId, charAt }: Props) {
  const text = message.text
  if (mode === 'braille') return <BrailleOut text={text} lang={message.lang} grade={grade} />
  if (mode === 'sign') {
    return (
      <div className="flex flex-col gap-3">
        <SignSequence key={message.id} text={text} lang={signLang} autoPlay />
        <p lang={message.lang} className="text-[1.25rem] text-ink-muted">{text}</p>
      </div>
    )
  }
  if (mode === 'speech' && speakingId === message.id) return <Spoken text={text} lang={message.lang} charAt={charAt} />
  return <p lang={message.lang} className={LARGE}>{text}</p>
}

function Spoken({ text, lang, charAt }: { text: string; lang: string; charAt: number }) {
  const spans = useMemo(() => wordSpans(text), [text])
  const current = spans.findIndex(([s, e]) => charAt >= s && charAt < e)
  return (
    <p lang={lang} className={LARGE}>
      {spans.map(([s, e], i) => (
        <span key={s} className={`rounded-[4px] transition-colors duration-100 ${i === current ? 'bg-live-fill text-white' : i > current && current >= 0 ? 'text-ink-muted' : ''}`}>
          {text.slice(s, e)}{' '}
        </span>
      ))}
    </p>
  )
}

function BrailleOut({ text, lang, grade }: { text: string; lang: string; grade: BrailleGrade }) {
  // Grade 1 shows instantly from the built-in table; liblouis replaces it a moment later.
  const instant = useMemo(() => translateGrade1(text).unicode, [text])
  const [out, setOut] = useState<{ key: string; unicode: string; offline: boolean } | null>(null)
  const key = `${grade}:${text}`
  useEffect(() => {
    let live = true
    toBraille(text, grade === 'g2' ? 'en-ueb-g2' : 'en-ueb-g1')
      .then((r) => { if (live) setOut({ key, unicode: r.unicode, offline: r.engine === 'offline-grade1' }) })
      .catch(() => { if (live) setOut({ key, unicode: instant, offline: true }) })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const ready = out?.key === key ? out : null
  const unicode = ready?.unicode ?? instant
  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only">Braille: {unicode}</p>
      <DotGrid unicode={unicode} size={34} />
      <p lang={lang} className="text-[1.125rem] text-ink-muted">
        {text}
        {grade === 'g2' && ready?.offline && <span className="ml-2 text-warn">Offline: Grade 1 shown</span>}
      </p>
    </div>
  )
}
