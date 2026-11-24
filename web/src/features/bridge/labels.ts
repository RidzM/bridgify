import type { Profile, ReceiveMode, SendMode, TextSource } from '@/engines/bridge/packets'
import type { FailReason } from '@/engines/bridge/transport'
import type { EndReason } from '@/engines/bridge/session'
import { spacedCode } from '@/engines/bridge/code'
import { SIGN_LANGS } from '@/lib/signLangs'

export const RECEIVE_OPTIONS: { id: ReceiveMode; label: string; hint: string }[] = [
  { id: 'captions', label: 'Captions', hint: 'Large text on your screen' },
  { id: 'speech', label: 'Speech', hint: 'Your phone reads each message aloud' },
  { id: 'braille', label: 'Braille', hint: 'Braille cells, Grade 1 or Grade 2' },
  { id: 'sign', label: 'Sign', hint: 'Signs in the sign language you choose' },
]

export const SEND_OPTIONS: { id: SendMode; label: string }[] = [
  { id: 'type', label: 'Type' },
  { id: 'speak', label: 'Speak' },
  { id: 'quick', label: 'Quick phrases' },
  { id: 'fingerspell', label: 'Fingerspell' },
]

const signCode = (p: Profile) => SIGN_LANGS.find((l) => l.id === p.signLang)?.code ?? 'ISL'

const RECEIVES: Record<ReceiveMode, (p: Profile) => string> = {
  captions: () => 'reads captions',
  speech: () => 'listens to speech',
  braille: (p) => `reads braille (Grade ${p.grade === 'g2' ? 2 : 1})`,
  sign: (p) => `watches signs in ${signCode(p)}`,
}
const SENDS: Record<SendMode, string> = { type: 'types', speak: 'speaks', quick: 'uses quick phrases', fingerspell: 'fingerspells' }

export const theirName = (p: Profile | null) => p?.name || 'The other person'

/** "Riya reads braille (Grade 1) and fingerspells." */
export const describePeer = (p: Profile) => `${theirName(p)} ${RECEIVES[p.receive](p)} and ${SENDS[p.send]}.`

export const SOURCE_LABEL: Record<TextSource | 'gloss', string> = {
  typed: 'typed', speech: 'spoken', quick: 'quick phrase', fingerspell: 'fingerspelled', 'sign-word': 'signed', gloss: 'sign gloss',
}

export const timeOf = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function failMessage(reason: FailReason, code: string): string {
  switch (reason) {
    case 'not-found': return `No one is using code ${spacedCode(code)} right now. Check the code on the other phone, or ask them to start a new conversation.`
    case 'full': return 'This conversation already has two people. Ask the other person for a new code.'
    case 'unsupported': return "This browser can't link to another phone. Try an up-to-date Chrome, Edge, Firefox or Safari."
    case 'taken': return 'That code is already in use. Start a new conversation to get a fresh code.'
    case 'network': return "Couldn't reach the other phone. Both phones need internet, and some school or office Wi-Fi blocks this. Try mobile data."
  }
}

export function endMessage(reason: EndReason, peer: Profile | null): string {
  switch (reason) {
    case 'left': return `${theirName(peer)} left the conversation.`
    case 'you-left': return 'You left the conversation.'
    case 'lost': return `Lost the connection to ${peer?.name || 'the other phone'}, and it didn't come back within 30 seconds.`
    case 'expired': return 'The conversation closed after 30 minutes without messages.'
  }
}
