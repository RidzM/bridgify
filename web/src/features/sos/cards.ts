import sos from '@content/phrases/sos.json'
import { parseContact, speakableNumber } from './contact'

export interface SosCard {
  id: string
  text: string
  hi?: string
  /** The person's own detail shown under the phrase: the contact number or medical notes. */
  extra: string | null
  /** What Speak says (numbers digit by digit). */
  speech: string
}

interface Preset { id: string; text: string; hi?: string; adds?: string }

/** Builds the cards from content/phrases/sos.json plus the details saved on this device. */
export function buildCards(details: { name: string; contact: string; notes: string }): SosCard[] {
  const contact = parseContact(details.contact)
  const notes = details.notes.trim()
  return (sos.presets as Preset[]).map((p) => {
    if (p.adds === 'contact' && contact.number) {
      const who = contact.label !== contact.number ? ` (${contact.label})` : ''
      return { id: p.id, text: p.text, hi: p.hi, extra: `${contact.number}${who}`, speech: `${p.text} ${speakableNumber(contact.number)}.` }
    }
    if (p.adds === 'notes' && notes) return { id: p.id, text: p.text, hi: p.hi, extra: notes, speech: `${p.text} ${notes}` }
    return { id: p.id, text: p.text, hi: p.hi, extra: null, speech: p.text }
  })
}
