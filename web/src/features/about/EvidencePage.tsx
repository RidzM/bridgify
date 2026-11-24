import { AboutLayout } from './AboutLayout'
import evidence from '@content/evidence.json'

export default function EvidencePage() {
  return (
    <AboutLayout title="Evidence" intro="How well each part works, measured on people and data the models never saw.">
      <section aria-labelledby="ev-models">
        <h2 id="ev-models">Recognition accuracy</h2>
        <div className="mt-3 grid gap-4">
          {evidence.models.map((m) => (
            <article key={m.id} className="rounded-[12px] border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3>{m.name}</h3>
                <p className="mt-0 text-[1.75rem] font-semibold tabular">{m.id === 'gestures' ? `${(m.value * 100).toFixed(1)}%` : m.value.toFixed(3)}</p>
              </div>
              <p className="mt-0 text-ink-muted">{m.metric}</p>
              <p className="text-[0.9375rem]">{m.detail}</p>
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer py-2 text-brand">Show the confusion chart</summary>
                <img src={m.chart} alt={`Confusion chart for ${m.name}`} loading="lazy" className="mt-2 w-full max-w-[560px] rounded-[8px] border border-line bg-white" />
              </details>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="ev-checks">
        <h2 id="ev-checks">Quality checks</h2>
        <dl className="mt-2 divide-y divide-line rounded-[12px] border border-line bg-surface">
          {evidence.checks.map((c) => (
            <div key={c.name} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <dt>{c.name}</dt>
              <dd className="font-medium">{c.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[0.9375rem] text-ink-muted">Updated {evidence.updated}. Full method and numbers: docs/EVAL.md in the project repository.</p>
      </section>
    </AboutLayout>
  )
}
