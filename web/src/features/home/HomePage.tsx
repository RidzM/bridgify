import { Link } from 'react-router-dom'
import { Captions, ScanLine, Volume2, MessagesSquare, ChevronRight } from 'lucide-react'
import { Composer } from './Composer'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { usePrefs } from '@/stores/prefs'
import type { ToolId } from '@/lib/tools'

const START = [
  { to: '/tools/speech-to-text', tool: 'speech-to-text', icon: Captions, title: 'Caption a conversation', body: 'Live text of what someone is saying.' },
  { to: '/tools/sign-to-text', tool: 'sign-to-text', icon: ScanLine, title: 'Fingerspell to the camera', body: 'ASL or ISL letters, read on this device.' },
  { to: '/tools/text-to-speech', tool: 'text-to-speech', icon: Volume2, title: 'Speak for me', body: 'Type or tap a phrase and it is said aloud.' },
] as const

export default function HomePage() {
  useDocumentTitle('')
  const hidden = usePrefs((s) => s.hiddenTools)
  const start = START.filter((s) => !hidden.includes(s.tool as ToolId))
  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-8 pt-6 md:px-8 lg:pt-12">
      <h1 className="sr-only">Bridgify</h1>
      <p className="mb-6 max-w-[56ch] text-[1.0625rem] text-ink-muted">
        Type once and Bridgify shows it as speech, braille and large print. Camera and microphone tools run on this device.
      </p>

      <Composer />

      {start.length > 0 && (
        <nav aria-labelledby="start" className="mt-8 lg:hidden">
          <h2 id="start" className="mb-2 text-base">Or start with</h2>
          <ul className="overflow-hidden rounded-[12px] border border-line bg-surface">
            {start.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="flex min-h-16 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2">
                  <s.icon aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                  <span className="flex-1">
                    <span className="block font-medium">{s.title}</span>
                    <span className="block text-[0.9375rem] text-ink-muted">{s.body}</span>
                  </span>
                  <ChevronRight aria-hidden size={18} className="text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section aria-labelledby="bridge" className="focus-hide mt-8 flex flex-col gap-4 rounded-[12px] border border-line bg-surface p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <MessagesSquare aria-hidden size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand" />
          <div>
            <h2 id="bridge" className="text-base">Talking with someone on another phone?</h2>
            <p className="mt-0.5 text-[0.9375rem] text-ink-muted">Bridge links two phones. Each person reads or hears the conversation in their own way.</p>
          </div>
        </div>
        <Link to="/bridge" className="press inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-line px-4 font-medium text-ink no-underline hover:border-line-strong">
          Start a Bridge
        </Link>
      </section>
    </div>
  )
}
