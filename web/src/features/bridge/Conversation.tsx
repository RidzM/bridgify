import { useCallback, useMemo } from 'react'
import { LogOut, RotateCcw, Volume2 } from 'lucide-react'
import { Panel, Select } from '@/components/tool/Field'
import { QuickAccess, type PhraseSet } from '@/components/tool/QuickAccess'
import { Button } from '@/components/ui/Button'
import type { BridgeSession, ChatMessage, SessionSnapshot } from '@/engines/bridge/session'
import type { TextSource } from '@/engines/bridge/packets'
import type { Hand } from '@/engines/vision/types'
import { SIGN_LANGS } from '@/lib/signLangs'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { usePrefs } from '@/stores/prefs'
import en from '@content/phrases/quick-access.en.json'
import { FingerspellSender } from './FingerspellSender'
import { ModePicker } from './ModePicker'
import { ReceiveView } from './ReceiveView'
import { RemoteHands } from './RemoteHands'
import { SpeakSender } from './SpeakSender'
import { Meter, Transcript } from './Transcript'
import { TypeSender } from './TypeSender'
import { RECEIVE_OPTIONS, SEND_OPTIONS, SOURCE_LABEL, describePeer, theirName, timeOf } from './labels'
import { useBridgePrefs } from './store'
import { useSpeechOut } from './useSpeechOut'

interface Props {
  session: BridgeSession
  snapshot: SessionSnapshot
  messages: ChatMessage[]
  add: (m: ChatMessage | null) => void
  onLeave: () => void
}

const GRADES = [{ id: 'g1', label: 'Grade 1' }, { id: 'g2', label: 'Grade 2' }] as const

export function Conversation({ session, snapshot, messages, add, onLeave }: Props) {
  const prefs = useBridgePrefs()
  const sign = usePrefs((s) => s.sign)
  const sttLang = usePrefs((s) => s.stt.lang)
  const setPref = usePrefs((s) => s.set)
  const peer = snapshot.peerProfile
  const name = theirName(peer)
  const shortName = peer?.name || 'They'
  const reconnecting = snapshot.state === 'reconnecting'
  const latest = useMemo(() => [...messages].reverse().find((m) => !m.mine) ?? null, [messages])
  const speech = useSpeechOut(latest, prefs.receive === 'speech')
  useDocumentTitle(peer?.name ? `Talking with ${peer.name}` : 'Bridge conversation')

  const send = useCallback((text: string, src: TextSource, lang: string) => add(session.sendText(text, src, lang)), [add, session])
  const onHands = useCallback((h: readonly Hand[]) => session.sendHands(h), [session])
  const onHandsOff = useCallback(() => session.stopHands(), [session])

  // Screen readers hear each new message (speech mode already reads it aloud). A zero-width
  // space alternates so two identical messages in a row are both announced.
  const announce = latest && prefs.receive !== 'speech' ? `${name}: ${latest.text}${messages.length % 2 ? String.fromCharCode(0x200b) : ''}` : ''

  const a = snapshot.activity
  const activity = a.typing ? `${shortName} ${peer?.name ? 'is' : 'are'} typing…` : a.listening ? `${shortName} ${peer?.name ? 'is' : 'are'} speaking…` : a.signing ? `${shortName} ${peer?.name ? 'is' : 'are'} signing…` : ''

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-8 pt-6 md:px-8 md:pt-8">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.5rem] md:text-[1.75rem]">{peer?.name ? `Talking with ${peer.name}` : 'Conversation'}</h1>
          <p role="status" className="mt-1.5 flex items-center gap-2 text-[0.9375rem]">
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${reconnecting ? 'border-2 border-warn' : 'bg-live-fill'}`} />
            {reconnecting
              ? <span className="text-warn">Reconnecting. Anything you send now goes out when the link is back.</span>
              : <span>Connected{snapshot.link === 'local' ? ' to another tab' : ''}</span>}
          </p>
          {peer && <p className="mt-1 text-ink-muted">{describePeer(peer)}</p>}
        </div>
        <Button onClick={onLeave} className="shrink-0" icon={<LogOut aria-hidden size={16} />}>Leave</Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel label={`Latest from ${name}`} className="flex min-h-[15rem] flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-[0.9375rem] font-medium text-ink-muted">
                {latest ? `${name} · ${timeOf(latest.at)} · ${SOURCE_LABEL[latest.src]}` : `From ${name}`}
              </h2>
              {activity && <p className="text-[0.9375rem] text-live">{activity}</p>}
            </div>
            {latest
              ? <ReceiveView message={latest} mode={prefs.receive} grade={prefs.grade} signLang={sign.lang} speakingId={speech.speakingId} charAt={speech.charAt} />
              : <p className="text-[1.25rem] text-ink-muted">{name === 'The other person' ? 'Their' : `${name}'s`} messages appear here as {RECEIVE_OPTIONS.find((o) => o.id === prefs.receive)!.label.toLowerCase()}.</p>}
            {prefs.receive === 'speech' && speech.needsTap && (
              <Button variant="primary" onClick={speech.enable} icon={<Volume2 aria-hidden size={18} />} className="self-start">Turn on speech</Button>
            )}
            {prefs.receive === 'speech' && speech.unavailable && <p className="text-[0.9375rem] text-warn">This device couldn't speak the message. It is shown as text.</p>}
            <RemoteHands session={session} name={name === 'The other person' ? 'the other person' : name} />
            <div className="mt-auto flex flex-wrap items-end gap-x-4 gap-y-3">
              <ModePicker label="How you receive" value={prefs.receive} options={RECEIVE_OPTIONS} onChange={(receive) => prefs.update({ receive })} />
              {prefs.receive === 'braille' && <ModePicker label="Braille" value={prefs.grade} options={GRADES} onChange={(grade) => prefs.update({ grade })} />}
              {prefs.receive === 'sign' && (
                <Select label="Sign language" value={sign.lang} onChange={(e) => setPref('sign', { ...sign, lang: e.target.value as typeof sign.lang })} className="min-w-44">
                  {SIGN_LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              )}
              {prefs.receive === 'speech' && latest && !speech.needsTap && (
                <Button onClick={() => speech.repeat(latest)} icon={<RotateCcw aria-hidden size={16} />}>Repeat</Button>
              )}
            </div>
            <p className="sr-only" aria-live="polite">{announce}</p>
          </Panel>

          <section aria-label="Send a message" className="flex flex-col gap-3">
            <ModePicker grid label="How you send" value={prefs.send} options={SEND_OPTIONS} onChange={(s) => prefs.update({ send: s })} />
            {prefs.send === 'quick'
              ? <QuickAccess set={en as PhraseSet} onPick={(t) => send(t, 'quick', 'en-IN')} title="Tap a phrase to send it" />
              : (
                <Panel className="p-4 md:p-5">
                  {prefs.send === 'type' && <TypeSender onSend={(t) => send(t, 'typed', sttLang)} onTyping={(typing) => session.setActivity({ typing })} />}
                  {prefs.send === 'speak' && <SpeakSender lang={sttLang} onSend={(t) => send(t, 'speech', sttLang)} onListening={(listening) => session.setActivity({ listening })} />}
                  {prefs.send === 'fingerspell' && (
                    <FingerspellSender
                      onSend={(w) => send(w, 'fingerspell', 'en')}
                      onSigning={(signing) => session.setActivity({ signing })}
                      showHands={prefs.showHands}
                      onShowHands={(showHands) => prefs.update({ showHands })}
                      onHands={onHands}
                      onHandsOff={onHandsOff}
                    />
                  )}
                </Panel>
              )}
          </section>
        </div>

        <Panel label="Conversation" className="flex flex-col gap-4 self-start p-5 md:p-6">
          <h2 className="text-base">Conversation</h2>
          <Transcript messages={messages} peerName={name} />
        </Panel>
      </div>

      <div className="mt-6"><Meter session={session} /></div>
    </div>
  )
}
