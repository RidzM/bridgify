import { forwardRef, useId } from 'react'
import { Button } from '@/components/ui/Button'
import { usePrefs } from '@/stores/prefs'

interface Props { editing: boolean; onEditing: (v: boolean) => void }

const input = 'w-full rounded-[10px] border border-line bg-bg px-3.5 text-ink outline-none hover:border-line-strong focus:border-brand'

/** Name, emergency contact and medical notes. Saved as you type, on this device only. */
export const MyDetails = forwardRef<HTMLInputElement, Props>(function MyDetails({ editing, onEditing }, contactRef) {
  const sos = usePrefs((s) => s.sos)
  const set = usePrefs((s) => s.set)
  const ids = { name: useId(), contact: useId(), contactHint: useId(), notes: useId(), notesHint: useId(), title: useId() }
  const missing = <span className="text-ink-muted">Not added</span>

  return (
    <section aria-labelledby={ids.title} className="rounded-[16px] border border-line bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={ids.title}>Your details</h2>
        <Button variant={editing ? 'primary' : 'secondary'} onClick={() => onEditing(!editing)}>{editing ? 'Done' : 'Edit'}</Button>
      </div>
      <p className="mt-1 text-[0.9375rem] text-ink-muted">Kept on this device only. The call card and the medical card use them.</p>
      {editing ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={ids.name} className="mb-1.5 block font-medium">Your name</label>
            <input id={ids.name} value={sos.name} autoComplete="name" onChange={(e) => set('sos', { ...sos, name: e.target.value.slice(0, 80) })} className={`min-h-11 ${input}`} />
          </div>
          <div>
            <label htmlFor={ids.contact} className="mb-1.5 block font-medium">Emergency contact</label>
            <input ref={contactRef} id={ids.contact} value={sos.contact} aria-describedby={ids.contactHint} autoComplete="off" onChange={(e) => set('sos', { ...sos, contact: e.target.value.slice(0, 120) })} className={`min-h-11 ${input}`} />
            <p id={ids.contactHint} className="mt-1.5 text-[0.875rem] text-ink-muted">A name and a phone number, for example: Amma, 98765 43210</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor={ids.notes} className="mb-1.5 block font-medium">Medical notes</label>
            <textarea id={ids.notes} rows={3} value={sos.notes} aria-describedby={ids.notesHint} onChange={(e) => set('sos', { ...sos, notes: e.target.value.slice(0, 400) })} className={`resize-y py-2.5 ${input}`} />
            <p id={ids.notesHint} className="mt-1.5 text-[0.875rem] text-ink-muted">Conditions, allergies or medicines a helper should know.</p>
          </div>
        </div>
      ) : (
        <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt className="text-ink-muted">Name</dt>
          <dd className="break-words">{sos.name || missing}</dd>
          <dt className="text-ink-muted">Emergency contact</dt>
          <dd className="break-words">{sos.contact || missing}</dd>
          <dt className="text-ink-muted">Medical notes</dt>
          <dd className="whitespace-pre-line break-words">{sos.notes || missing}</dd>
        </dl>
      )}
    </section>
  )
})
