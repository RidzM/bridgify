/**
 * Room codes (SYSTEM-ARCHITECTURE §7.3): 6 characters with no look-alikes (no 0/O, 1/I/L),
 * 31^6 ≈ 887 million combinations. The host registers `bridgify-<CODE>` with the PeerJS broker.
 */
export const ROOM_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6
const VALID = new RegExp(`^[${ROOM_ALPHABET}]{${CODE_LENGTH}}$`)

export const peerIdFor = (code: string) => `bridgify-${code}`
export const channelFor = (code: string) => `bridgify-bridge-${code}`

/** Unbiased random code (rejection sampling over crypto bytes). */
export function newRoomCode(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % ROOM_ALPHABET.length) // 248: largest multiple of 31 below 256
  let out = ''
  while (out.length < CODE_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b >= limit) continue
      out += ROOM_ALPHABET[b % ROOM_ALPHABET.length]
      if (out.length === CODE_LENGTH) break
    }
  }
  return out
}

/** Accepts messy input (Postel): lowercase, spaces, dashes, or a pasted link. */
export function normalizeCode(input: string): string {
  const fromLink = /\/bridge\/([^/?#\s]+)/i.exec(input)
  const raw = fromLink ? fromLink[1]! : input
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export const isValidCode = (code: string) => VALID.test(code)

/** A plain explanation of what is wrong with a typed code, or null when it is usable. */
export function codeProblem(input: string): string | null {
  const code = normalizeCode(input)
  if (!code) return 'Type the 6-character code from the other phone.'
  if (/[01ILO]/.test(code)) return 'Codes never use 0, O, 1, I or L. Check the code on the other phone.'
  if (code.length < CODE_LENGTH) return `That code is too short. Codes have ${CODE_LENGTH} characters.`
  if (code.length > CODE_LENGTH) return `That code is too long. Codes have ${CODE_LENGTH} characters.`
  return isValidCode(code) ? null : 'That code has a character codes never use. Check it on the other phone.'
}

/** "K7M2QX" → "K7M 2QX" for display. */
export const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

/** "K7M2QX" → "K, 7, M, 2, Q, X" so speech and screen readers say one character at a time. */
export const speakableCode = (code: string) => [...code].join(', ')
