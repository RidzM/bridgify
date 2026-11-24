import type { SignLang } from '@/stores/prefs'

export interface SignLangInfo {
  id: SignLang
  code: string
  name: string
  region: string
  spoken: string
  /** BCP-47 tag for quick-access phrases and speech. */
  speechLang: string
  /** sign.mt codes for the pose fallback. */
  signMt: { signed: string; spoken: string }
  recognition: boolean
}

export const SIGN_LANGS: SignLangInfo[] = [
  { id: 'isl', code: 'ISL', name: 'Indian Sign Language', region: 'India', spoken: 'Hindi', speechLang: 'hi-IN', signMt: { signed: 'ins', spoken: 'en' }, recognition: true },
  { id: 'asl', code: 'ASL', name: 'American Sign Language', region: 'USA and Canada', spoken: 'English', speechLang: 'en-US', signMt: { signed: 'ase', spoken: 'en' }, recognition: true },
  { id: 'lsf', code: 'FSL', name: 'French Sign Language', region: 'France', spoken: 'French', speechLang: 'fr-FR', signMt: { signed: 'fsl', spoken: 'fr' }, recognition: false },
  { id: 'lsm', code: 'LSM', name: 'Mexican Sign Language', region: 'Mexico', spoken: 'Spanish', speechLang: 'es-MX', signMt: { signed: 'mfs', spoken: 'es' }, recognition: false },
  { id: 'lis', code: 'LIS', name: 'Italian Sign Language', region: 'Italy', spoken: 'Italian', speechLang: 'it-IT', signMt: { signed: 'ise', spoken: 'it' }, recognition: false },
  { id: 'dgs', code: 'DGS', name: 'German Sign Language', region: 'Germany', spoken: 'German', speechLang: 'de-DE', signMt: { signed: 'gsg', spoken: 'de' }, recognition: false },
]

export const signLang = (id: SignLang) => SIGN_LANGS.find((l) => l.id === id)!
