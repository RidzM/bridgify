/** Helpers for the SOS card: a free-text emergency contact like "Amma, 98765 43210". */

export interface Contact { label: string; tel: string | null; number: string | null }

/**
 * Finds the phone number in the contact text and what to call the person.
 * "Amma, +91 98765 43210" → label "Amma", tel "+919876543210", number "+91 98765 43210".
 */
export function parseContact(raw: string): Contact {
  const text = raw.replace(/\s+/g, ' ').trim()
  const digitCount = (s: string) => s.replace(/\D/g, '').length
  const candidates = [...text.matchAll(/\+?\d(?:[\d\s().-]*\d)?/g)].filter((m) => digitCount(m[0]) >= 3)
  const best = candidates.sort((a, b) => digitCount(b[0]) - digitCount(a[0]))[0]
  if (!best) return { label: text, tel: null, number: null }
  const number = best[0].trim()
  const tel = number.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  const label = (text.slice(0, best.index) + text.slice(best.index + best[0].length)).replace(/^[\s,:;()-]+|[\s,:;()-]+$/g, '').replace(/\(\s*\)/g, '').trim()
  return { label: label || number, tel, number }
}

/** Phone numbers are read digit by digit ("9 8 7 6 5, 4 3 2 1 0"), not as one big number. */
export function speakableNumber(number: string): string {
  const groups = number.split(/[^\d]+/).filter(Boolean).map((g) => [...g].join(' '))
  return (number.trim().startsWith('+') ? 'plus ' : '') + groups.join(', ')
}

export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`
}
