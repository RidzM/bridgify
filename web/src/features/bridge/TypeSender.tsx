import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props { onSend: (text: string) => void; onTyping: (typing: boolean) => void }

/** Type and send. Enter sends; Shift+Enter adds a line. "Typing…" shows on the other phone. */
export function TypeSender({ onSend, onTyping }: Props) {
  const [text, setText] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typing = useRef(false)
  const id = useId()
  const hintId = useId()

  const setTyping = (v: boolean) => { if (typing.current !== v) { typing.current = v; onTyping(v) } }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!text.trim()) return
    onSend(text)
    setText('')
    if (timer.current) clearTimeout(timer.current)
    setTyping(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">Your message</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          id={id}
          rows={2}
          value={text}
          enterKeyHint="send"
          aria-describedby={hintId}
          onChange={(e) => {
            setText(e.target.value)
            setTyping(e.target.value.length > 0)
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => setTyping(false), 2500)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
          className="min-h-[4.5rem] w-full flex-1 resize-y rounded-[10px] border border-line bg-bg px-4 py-3 text-[1.25rem] leading-snug text-ink outline-none placeholder:text-ink-muted focus:border-brand"
        />
        <Button type="submit" variant="primary" size="lg" disabled={!text.trim()} icon={<SendHorizontal aria-hidden size={18} />}>Send</Button>
      </div>
      <p id={hintId} className="text-[0.8125rem] text-ink-muted">Enter sends. Shift and Enter starts a new line.</p>
    </form>
  )
}
