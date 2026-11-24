import { useRef } from 'react'
import { Copy, Volume2 } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { spacedCode, speakableCode } from '@/engines/bridge/code'
import type { SessionSnapshot } from '@/engines/bridge/session'
import { Speaker } from '@/engines/speech/tts'
import { QrCode } from './QrCode'
import { ModePicker } from './ModePicker'
import { RECEIVE_OPTIONS } from './labels'
import { useBridgePrefs } from './store'

interface Props { snapshot: SessionSnapshot; onRetryBroker: () => void; onCancel: () => void }

export function WaitingView({ snapshot, onRetryBroker, onCancel }: Props) {
  const prefs = useBridgePrefs()
  const speaker = useRef(new Speaker())
  const code = snapshot.code
  const link = `${location.origin}/bridge/${code}`
  const brokerDown = snapshot.broker === 'down'
  const ready = snapshot.broker === 'listening'

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied') } catch { toast(`Copy this link: ${link}`) }
  }
  const readAloud = () => speaker.current.speak(`The code is: ${speakableCode(code)}.`, { lang: 'en-IN', rate: 0.85, onError: (m) => toast(m) })

  return (
    <ToolFrame title="Bridge" purpose="Show this code to the other person. The conversation opens on both phones when they join." privacy={{ where: 'device', detail: 'Phone to phone. Nothing is stored.' }}>
      <Panel label="Your code" className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:p-8">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h2 className="text-[0.9375rem] font-medium text-ink-muted">Code for the other phone</h2>
            <p className="mt-2 font-semibold leading-none tracking-[0.12em] text-ink tabular text-[clamp(3rem,2rem+5vw,5.5rem)]">
              <span aria-hidden data-testid="room-code">{spacedCode(code)}</span>
              <span className="sr-only">{speakableCode(code)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={readAloud} icon={<Volume2 aria-hidden size={18} />}>Read code aloud</Button>
            <Button onClick={copy} icon={<Copy aria-hidden size={16} />}>Copy link</Button>
          </div>
          <p className="text-ink-muted">On their phone: open Bridge, choose Join with a code and type it. Or point the camera at the QR code.</p>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p role="status" className="flex items-center gap-2.5 text-[0.9375rem]">
              {brokerDown ? null : <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${ready ? 'bg-live-fill' : 'border-2 border-line-strong'}`} />}
              {brokerDown ? '' : ready ? 'Waiting for the other phone to join…' : 'Getting the code ready…'}
            </p>
            <Button variant="quiet" onClick={onCancel}>Cancel</Button>
          </div>
          {brokerDown && (
            <div role="alert" className="flex flex-col gap-3 rounded-[12px] border border-line-strong bg-bg p-4">
              <p>Phones can't reach this conversation right now. This device has no internet, or this network blocks the connection.</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={onRetryBroker}>Try again</Button>
                <a href={`/bridge/${code}?via=local`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center">Open it in another tab on this device</a>
              </div>
            </div>
          )}
        </div>
        <figure className="flex flex-col items-center gap-2 self-start">
          <QrCode value={link} label={`QR code that opens the conversation ${spacedCode(code)}`} className="h-auto w-[min(15rem,70vw)] border border-line p-1" />
          <figcaption className="text-[0.875rem] text-ink-muted">Scan to join</figcaption>
        </figure>
      </Panel>

      <ModePicker
        label="How you want to receive messages"
        value={prefs.receive}
        options={RECEIVE_OPTIONS}
        onChange={(receive) => prefs.update({ receive })}
        hint={RECEIVE_OPTIONS.find((o) => o.id === prefs.receive)?.hint}
        className="mt-5 max-w-xl"
      />
      {!brokerDown && (
        <p className="mt-6 text-[0.875rem] text-ink-muted">
          Trying Bridge on one computer? <a href={`/bridge/${code}?via=local`} target="_blank" rel="noopener">Open this conversation in a second tab</a>.
        </p>
      )}
    </ToolFrame>
  )
}
