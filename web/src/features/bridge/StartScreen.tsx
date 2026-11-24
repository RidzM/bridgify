import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { codeProblem, newRoomCode, normalizeCode } from '@/engines/bridge/code'
import { preloadPeer } from '@/engines/bridge/peerTransport'
import { ModePicker } from './ModePicker'
import { RECEIVE_OPTIONS } from './labels'
import { useBridgePrefs } from './store'

const PRIVACY = { where: 'device' as const, detail: 'Phone to phone. Nothing is stored.' }

export function StartScreen({ initialCode = '', initialError = null }: { initialCode?: string; initialError?: string | null }) {
  const navigate = useNavigate()
  const prefs = useBridgePrefs()
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<string | null>(initialError)
  const codeInput = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const codeId = useId()
  const errorId = useId()
  // Start or Join is the next tap: have the connection library ready by then.
  useEffect(() => { const t = setTimeout(preloadPeer, 300); return () => clearTimeout(t) }, [])

  const start = () => navigate(`/bridge/${newRoomCode()}`, { state: { host: true } })
  const join = (e: FormEvent) => {
    e.preventDefault()
    const problem = codeProblem(code)
    if (problem) { setError(problem); codeInput.current?.focus(); return }
    navigate(`/bridge/${normalizeCode(code)}`)
  }

  return (
    <ToolFrame title="Bridge" purpose="Two phones, one conversation. Each person reads or hears it in their own way." privacy={PRIVACY}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Panel label="Start a conversation" className="flex flex-col gap-5 p-5 md:p-6">
          <div>
            <h2>Start a conversation</h2>
            <p className="mt-1 text-ink-muted">You get a code and a QR code to show the other person.</p>
          </div>
          <div>
            <label htmlFor={nameId} className="mb-1.5 block font-medium">Your name <span className="font-normal text-ink-muted">(optional)</span></label>
            <input
              id={nameId}
              value={prefs.name}
              onChange={(e) => prefs.update({ name: e.target.value.slice(0, 40) })}
              autoComplete="name"
              className="min-h-11 w-full max-w-sm rounded-[10px] border border-line bg-bg px-3.5 text-ink outline-none hover:border-line-strong focus:border-brand"
            />
          </div>
          <ModePicker
            strong
            label="How you want to receive messages"
            value={prefs.receive}
            options={RECEIVE_OPTIONS}
            onChange={(receive) => prefs.update({ receive })}
            hint={RECEIVE_OPTIONS.find((o) => o.id === prefs.receive)?.hint}
          />
          <Button variant="primary" size="lg" className="self-start" onClick={start}>Start a conversation</Button>
        </Panel>

        <Panel label="Join with a code" className="flex flex-col gap-4 self-start p-5 md:p-6">
          <h2>Join with a code</h2>
          <form onSubmit={join} noValidate className="flex flex-col gap-3">
            <div>
              <label htmlFor={codeId} className="mb-1.5 block font-medium">Code from the other phone</label>
              <input
                ref={codeInput}
                id={codeId}
                value={code}
                onChange={(e) => { setCode(e.target.value); if (error) setError(null) }}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={64}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="min-h-14 w-full rounded-[10px] border border-line bg-bg px-3.5 text-[1.75rem] font-semibold uppercase tracking-[0.18em] text-ink outline-none tabular hover:border-line-strong focus:border-brand aria-[invalid]:border-danger"
              />
              {error && <p id={errorId} role="alert" className="mt-2 text-[0.9375rem] text-danger">{error}</p>}
            </div>
            <Button type="submit" size="lg" className="self-start">Join</Button>
          </form>
          <p className="text-[0.875rem] text-ink-muted">Scanned the QR code? Then the conversation opens by itself.</p>
        </Panel>
      </div>
    </ToolFrame>
  )
}
