/**
 * Bridge packets (SYSTEM-ARCHITECTURE §7.3). Only text, gloss, landmark and control packets
 * cross the network; never audio or video. Every incoming packet is size-checked and rebuilt
 * field by field, so anything unexpected is dropped rather than trusted.
 */
import type { SignLang } from '@/stores/prefs'

export const MAX_PACKET_BYTES = 8 * 1024
export const MAX_TEXT_CHARS = 2000
export const PROTOCOL_VERSION = 1

export type ReceiveMode = 'captions' | 'speech' | 'braille' | 'sign'
export type SendMode = 'type' | 'speak' | 'quick' | 'fingerspell'
export type TextSource = 'typed' | 'speech' | 'quick' | 'fingerspell' | 'sign-word'
export type BrailleGrade = 'g1' | 'g2'

export interface Profile {
  name: string
  receive: ReceiveMode
  send: SendMode
  /** BCP-47 language of what this person types or says, e.g. "en-IN". */
  lang: string
  /** Sign language this person wants signs shown in (receive = sign). */
  signLang: SignLang
  grade: BrailleGrade
}

export type Packet =
  | { k: 'hello'; v: number; ts: number; from: string; sid: string; profile: Profile }
  | { k: 'text'; id: string; ts: number; from: string; text: string; lang: string; src: TextSource }
  | { k: 'gloss'; id: string; ts: number; from: string; gloss: string[]; lang: SignLang }
  | { k: 'lm'; ts: number; from: string; hands: string; mask: number }
  | { k: 'status'; ts: number; from: string; typing?: boolean; listening?: boolean; signing?: boolean }
  | { k: 'receipt'; id: string; ts: number }
  | { k: 'ping'; ts: number; t0: number }
  | { k: 'pong'; ts: number; t0: number }
  | { k: 'bye'; ts: number; from: string }
  | { k: 'full'; ts: number }

export type PacketKind = Packet['k']

export const RECEIVE_MODES: readonly ReceiveMode[] = ['captions', 'speech', 'braille', 'sign']
export const SEND_MODES: readonly SendMode[] = ['type', 'speak', 'quick', 'fingerspell']
const SOURCES: readonly TextSource[] = ['typed', 'speech', 'quick', 'fingerspell', 'sign-word']
const SIGN_LANGS: readonly SignLang[] = ['asl', 'isl', 'lsf', 'lsm', 'lis', 'dgs']
const GRADES: readonly BrailleGrade[] = ['g1', 'g2']

const ID = /^[A-Za-z0-9_-]{1,40}$/
const LANG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/
// Control characters other than tab and newline never belong in a message.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function utf8Bytes(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++ } // surrogate pair
    else n += 3
  }
  return n
}

export function newId(len = 10): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (const b of crypto.getRandomValues(new Uint8Array(len))) s += abc[b % abc.length]
  return s
}

export const encodePacket = (p: Packet): string => JSON.stringify(p)

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const optBool = (v: unknown) => v === undefined || typeof v === 'boolean'
const oneOf = <T extends string>(v: unknown, set: readonly T[]): v is T => typeof v === 'string' && (set as readonly string[]).includes(v)

/** Removes control characters and trims; returns '' for anything that is not usable text. */
export function cleanText(v: unknown, max = MAX_TEXT_CHARS): string {
  if (typeof v !== 'string') return ''
  return v.replace(CONTROL, '').trim().slice(0, max)
}

export function decodeProfile(v: unknown): Profile | null {
  if (!isObj(v)) return null
  if (!oneOf(v.receive, RECEIVE_MODES) || !oneOf(v.send, SEND_MODES)) return null
  if (!str(v.lang, 24) || !LANG.test(v.lang) || !oneOf(v.signLang, SIGN_LANGS) || !oneOf(v.grade, GRADES)) return null
  return { name: cleanText(v.name, 40).replace(/\s+/g, ' '), receive: v.receive, send: v.send, lang: v.lang, signLang: v.signLang, grade: v.grade }
}

/** Parses and validates one packet. Returns null for anything malformed or over 8 KB. */
export function decodePacket(raw: unknown): Packet | null {
  if (typeof raw !== 'string' || raw.length > MAX_PACKET_BYTES || utf8Bytes(raw) > MAX_PACKET_BYTES) return null
  let v: unknown
  try { v = JSON.parse(raw) } catch { return null }
  if (!isObj(v) || !num(v.ts)) return null
  const ts = v.ts
  const from = str(v.from, 40) && ID.test(v.from) ? v.from : null
  switch (v.k) {
    case 'hello': {
      const profile = decodeProfile(v.profile)
      if (!from || !profile || !num(v.v) || !str(v.sid, 40) || !ID.test(v.sid)) return null
      return { k: 'hello', v: v.v, ts, from, sid: v.sid, profile }
    }
    case 'text': {
      const text = cleanText(v.text)
      if (!from || !text || !str(v.id, 40) || !ID.test(v.id) || !str(v.lang, 24) || !LANG.test(v.lang) || !oneOf(v.src, SOURCES)) return null
      return { k: 'text', id: v.id, ts, from, text, lang: v.lang, src: v.src }
    }
    case 'gloss': {
      if (!from || !str(v.id, 40) || !ID.test(v.id) || !oneOf(v.lang, SIGN_LANGS) || !Array.isArray(v.gloss) || v.gloss.length === 0 || v.gloss.length > 64) return null
      const gloss = v.gloss.map((g) => cleanText(g, 40))
      if (gloss.some((g) => !g)) return null
      return { k: 'gloss', id: v.id, ts, from, gloss, lang: v.lang }
    }
    case 'lm': {
      if (!from || !str(v.hands, 1024) || !BASE64.test(v.hands) || !num(v.mask) || !Number.isInteger(v.mask) || v.mask < 0 || v.mask > 15) return null
      return { k: 'lm', ts, from, hands: v.hands, mask: v.mask }
    }
    case 'status': {
      if (!from || !optBool(v.typing) || !optBool(v.listening) || !optBool(v.signing)) return null
      const p: Packet = { k: 'status', ts, from }
      if (typeof v.typing === 'boolean') p.typing = v.typing
      if (typeof v.listening === 'boolean') p.listening = v.listening
      if (typeof v.signing === 'boolean') p.signing = v.signing
      return p
    }
    case 'receipt':
      return str(v.id, 40) && ID.test(v.id) ? { k: 'receipt', id: v.id, ts } : null
    case 'ping':
    case 'pong':
      return num(v.t0) ? { k: v.k, ts, t0: v.t0 } : null
    case 'bye':
      return from ? { k: 'bye', ts, from } : null
    case 'full':
      return { k: 'full', ts }
    default:
      return null
  }
}
