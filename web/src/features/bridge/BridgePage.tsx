import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Download } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Panel } from '@/components/tool/Field'
import { Button } from '@/components/ui/Button'
import { codeProblem, isValidCode, newRoomCode, normalizeCode, spacedCode } from '@/engines/bridge/code'
import type { Via } from '@/engines/bridge/links'
import type { Profile } from '@/engines/bridge/packets'
import type { ChatMessage, SessionSnapshot } from '@/engines/bridge/session'
import type { Role } from '@/engines/bridge/transport'
import { downloadText } from '@/lib/download'
import { usePrefs } from '@/stores/prefs'
import { Conversation } from './Conversation'
import { StartScreen } from './StartScreen'
import { Transcript } from './Transcript'
import { WaitingView } from './WaitingView'
import { endMessage, failMessage, SOURCE_LABEL, theirName, timeOf } from './labels'
import { useBridgePrefs } from './store'
import { useBridgeSession } from './useBridgeSession'

const PRIVACY = { where: 'device' as const, detail: 'Phone to phone. Nothing is stored.' }

/** /bridge: start or join. /bridge/:code: the conversation (host if this tab started it). */
export default function BridgePage() {
  const { code: param } = useParams()
  const location = useLocation()
  const [search] = useSearchParams()
  const [tries, setTries] = useState({ code: '', n: 0 })
  const state = (location.state ?? {}) as { host?: boolean; code?: string }

  if (!param) return <StartScreen initialCode={state.code ?? ''} />
  const code = normalizeCode(param)
  const attempt = tries.code === code ? tries.n : 0
  if (!isValidCode(code)) return <StartScreen initialCode={param} initialError={`This link's code doesn't work. ${codeProblem(param) ?? ''}`.trim()} />
  const role: Role = state.host ? 'host' : 'guest'
  const viaParam = search.get('via')
  const via: Via = viaParam === 'local' || viaParam === 'peer' ? viaParam : 'auto'
  return <Room key={`${code}:${role}:${via}:${attempt}`} code={code} role={role} via={via} attempt={attempt} onRetry={() => setTries({ code, n: attempt + 1 })} />
}

function Room({ code, role, via, attempt, onRetry }: { code: string; role: Role; via: Via; attempt: number; onRetry: () => void }) {
  const navigate = useNavigate()
  const prefs = useBridgePrefs()
  const signLang = usePrefs((s) => s.sign.lang)
  const sttLang = usePrefs((s) => s.stt.lang)
  const profile = useMemo<Profile>(
    () => ({ name: prefs.name.trim(), receive: prefs.receive, send: prefs.send, lang: sttLang, signLang, grade: prefs.grade }),
    [prefs.name, prefs.receive, prefs.send, prefs.grade, sttLang, signLang],
  )
  const { session, snapshot, messages, add } = useBridgeSession(code, role, via, profile)
  const startNew = () => navigate(`/bridge/${newRoomCode()}`, { state: { host: true } })

  // A host whose code is taken (rare collision, or a reload racing the old registration):
  // try the same code twice more, then start fresh with a new one.
  useEffect(() => {
    if (role !== 'host' || snapshot.state !== 'failed' || snapshot.failure !== 'taken') return
    const t = setTimeout(() => (attempt < 2 ? onRetry() : navigate(`/bridge/${newRoomCode()}`, { replace: true, state: { host: true } })), 1500)
    return () => clearTimeout(t)
  }, [role, snapshot.state, snapshot.failure, attempt, onRetry, navigate])

  if (!session) return null
  switch (snapshot.state) {
    case 'starting':
    case 'waiting':
      return role === 'host'
        ? <WaitingView snapshot={snapshot} onRetryBroker={() => session.retryBroker()} onCancel={() => { session.leave(); navigate('/bridge') }} />
        : <Connecting code={code} onCancel={() => navigate('/bridge')} />
    case 'connecting':
      return <Connecting code={code} onCancel={() => navigate('/bridge')} />
    case 'connected':
    case 'reconnecting':
      return <Conversation session={session} snapshot={snapshot} messages={messages} add={add} onLeave={() => session.leave()} />
    case 'ended':
      return <Ended snapshot={snapshot} messages={messages} onNew={startNew} onJoin={() => navigate('/bridge')} />
    case 'failed':
      if (role === 'host' && snapshot.failure === 'taken') return <Connecting code={code} onCancel={() => navigate('/bridge')} host />
      return <Failed snapshot={snapshot} onRetry={onRetry} onOtherCode={() => navigate('/bridge', { state: { code: '' } })} onNew={startNew} />
  }
}

function Connecting({ code, onCancel, host = false }: { code: string; onCancel: () => void; host?: boolean }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t) }, [])
  return (
    <ToolFrame title="Bridge" purpose={host ? 'Getting a code ready.' : `Joining ${spacedCode(code)}.`} privacy={PRIVACY}>
      <Panel className="flex flex-col items-start gap-4 p-5 md:p-6">
        <p role="status" className="flex items-center gap-2.5 text-[1.125rem]">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-line-strong" />
          {host ? 'Getting a code ready…' : 'Looking for the other phone…'}
        </p>
        {slow && !host && <p className="text-ink-muted">Still looking. Check that the other phone is showing the code {spacedCode(code)}.</p>}
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </Panel>
    </ToolFrame>
  )
}

function Failed({ snapshot, onRetry, onOtherCode, onNew }: { snapshot: SessionSnapshot; onRetry: () => void; onOtherCode: () => void; onNew: () => void }) {
  const reason = snapshot.failure ?? 'network'
  return (
    <ToolFrame title="Bridge" purpose="The conversation couldn't open." privacy={PRIVACY}>
      <Panel className="flex flex-col items-start gap-5 p-5 md:p-6">
        <p role="alert" className="text-[1.125rem]">{failMessage(reason, snapshot.code)}</p>
        <div className="flex flex-wrap gap-2">
          {reason === 'full' || reason === 'taken'
            ? <Button variant="primary" onClick={onNew}>Start a new conversation</Button>
            : <Button variant="primary" onClick={onRetry}>Try again</Button>}
          {snapshot.role === 'guest' && reason !== 'full' && <Button onClick={onOtherCode}>Use a different code</Button>}
        </div>
      </Panel>
    </ToolFrame>
  )
}

function Ended({ snapshot, messages, onNew, onJoin }: { snapshot: SessionSnapshot; messages: ChatMessage[]; onNew: () => void; onJoin: () => void }) {
  const peerName = theirName(snapshot.peerProfile)
  const save = () => {
    const lines = messages.map((m) => `[${timeOf(m.at)}] ${m.mine ? 'You' : peerName} (${SOURCE_LABEL[m.src]}): ${m.text}`)
    downloadText(`bridgify-conversation-${snapshot.code}.txt`, ['Bridgify conversation', new Date().toLocaleString(), '', ...lines, ''].join('\n'))
  }
  return (
    <ToolFrame title="Bridge" purpose="The conversation has ended. Nothing from it is kept on any server." privacy={PRIVACY}>
      <Panel className="flex flex-col items-start gap-4 p-5 md:p-6">
        <p role="status" className="text-[1.25rem] font-medium">{snapshot.ended ? endMessage(snapshot.ended, snapshot.peerProfile) : 'The conversation ended.'}</p>
        {messages.length > 0 && <p className="text-ink-muted">The conversation is only on this screen. Save it now if you want to keep it.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onNew}>Start a new conversation</Button>
          {messages.length > 0 && <Button onClick={save} icon={<Download aria-hidden size={16} />}>Save the conversation</Button>}
          <Button variant="quiet" onClick={onJoin}>Join with a code</Button>
        </div>
      </Panel>
      {messages.length > 0 && (
        <Panel label="Conversation" className="mt-4 p-5 md:p-6">
          <Transcript messages={messages} peerName={peerName} />
        </Panel>
      )}
    </ToolFrame>
  )
}
