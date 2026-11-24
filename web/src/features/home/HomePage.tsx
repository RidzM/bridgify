import { Link } from 'react-router-dom'
import { EveryWayDemo } from './EveryWayDemo'
import { ToolDirectory } from './ToolDirectory'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

const WHO = [
  ['Deaf or hard of hearing', 'Live captions, sign tools, and a way to be understood without an interpreter in the room.'],
  ['Mute or non-verbal', 'Say what you need in one tap, out loud, in your own words.'],
  ['Blind or low vision', 'Braille in and out, large print, and a high-contrast interface.'],
  ['Autistic', 'Calm, predictable screens with no motion, and gestures that speak for you.'],
  ['Dyslexic', 'OpenDyslexic, wider spacing, and anything read aloud.'],
  ['Caregivers, teachers, doctors', 'Talk with everyone above, and learn braille and sign along the way.'],
]

export default function HomePage() {
  useDocumentTitle('')
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
      <div className="pb-6 pt-8 md:pt-12">
        <h1 className="max-w-[18ch] text-[clamp(2.1rem,1.2rem+3.4vw,3.5rem)]">Say it your way. Be understood every way.</h1>
        <p className="mt-4 text-lg text-ink-muted">One free tool for speech, text, braille and sign. Your camera and microphone stay on this device.</p>
      </div>

      <EveryWayDemo />

      <div className="mt-14">
        <ToolDirectory />
      </div>

      <section aria-labelledby="bridge-band" className="focus-hide mt-14 grid gap-6 border-y-2 border-brand py-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 id="bridge-band">Bridge: two phones, one conversation</h2>
          <p className="mt-2 text-ink-muted">One person signs or types, the other speaks. Each phone shows the conversation the way its owner takes it in: captions, speech, braille or signs.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/bridge" className="inline-flex min-h-12 items-center rounded-[var(--radius-control)] bg-brand px-5 font-bold text-brand-ink no-underline">Start a conversation</Link>
          <Link to="/bridge?join=1" className="inline-flex min-h-12 items-center rounded-[var(--radius-control)] border border-line-strong px-5 text-ink no-underline">Join with a code</Link>
        </div>
      </section>

      <section aria-labelledby="who" className="focus-hide my-14">
        <h2 id="who">Who it's for</h2>
        <dl className="mt-4 grid gap-x-12 md:grid-cols-2">
          {WHO.map(([who, why]) => (
            <div key={who} className="border-t border-line py-4">
              <dt className="font-bold">{who}</dt>
              <dd className="mt-1 text-ink-muted">{why}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
