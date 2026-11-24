import { Link } from 'react-router-dom'
import { Sheet } from '@/components/ui/Sheet'
import { SIGN_LANGS } from '@/lib/signLangs'

export function TutorialsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Tutorials" description="Learn braille and six sign languages.">
      <section aria-labelledby="tu-braille">
        <h2 id="tu-braille" className="mb-2 text-lg">Braille</h2>
        <ul className="divide-y divide-line border-y border-line">
          {[
            ['alphabet', 'Grade 1 alphabet', 'A to Z, one cell per letter'],
            ['numbers', 'Numbers', 'The number sign and 0 to 9'],
            ['contractions', 'Grade 2 contractions', 'Short forms fluent readers use'],
          ].map(([slug, name, desc]) => (
            <li key={slug}>
              <Link to={`/learn/braille/${slug}`} onClick={close} className="flex min-h-14 flex-col justify-center py-2 text-ink no-underline hover:text-brand">
                <span className="font-medium">{name}</span>
                <span className="text-sm text-ink-muted">{desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-7" aria-labelledby="tu-sign">
        <h2 id="tu-sign" className="mb-2 text-lg">Sign language</h2>
        <ul className="divide-y divide-line border-y border-line">
          {SIGN_LANGS.map((l) => (
            <li key={l.id}>
              <Link to={`/learn/sign/${l.id}/alphabet`} onClick={close} className="flex min-h-14 items-center justify-between gap-3 py-2 text-ink no-underline hover:text-brand">
                <span>
                  <span className="block font-medium">{l.name}</span>
                  <span className="text-sm text-ink-muted">{l.region}</span>
                </span>
                <span className="text-sm font-bold text-ink-muted">{l.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Sheet>
  )
}
