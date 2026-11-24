export type ToolId =
  | 'text-to-speech' | 'speech-to-text' | 'text-to-braille' | 'braille-to-text'
  | 'sign-to-text' | 'text-to-sign' | 'gesture-emotion'

export interface Tool {
  id: ToolId
  name: string
  path: string
  purpose: string
  direction: 'say' | 'understand'
  /** First letter, shown as a braille cell beside the name. */
  initial: string
}

export const TOOLS: Tool[] = [
  { id: 'text-to-speech', name: 'Text to speech', path: '/tools/text-to-speech', purpose: 'Type it and have it spoken aloud, with each word lit up as it is said.', direction: 'say', initial: 't' },
  { id: 'text-to-braille', name: 'Text to braille', path: '/tools/text-to-braille', purpose: 'Turn text into Grade 1, Grade 2 or Hindi Bharati braille you can read, print or emboss.', direction: 'say', initial: 'b' },
  { id: 'text-to-sign', name: 'Text to sign', path: '/tools/text-to-sign', purpose: 'See words as signs in six sign languages, with fingerspelling for the rest.', direction: 'say', initial: 's' },
  { id: 'speech-to-text', name: 'Speech to text', path: '/tools/speech-to-text', purpose: 'Live captions of what someone says, with punctuation added for you.', direction: 'understand', initial: 's' },
  { id: 'braille-to-text', name: 'Braille to text', path: '/tools/braille-to-text', purpose: 'Write braille on six keys like a Perkins brailler and get text and speech.', direction: 'understand', initial: 'b' },
  { id: 'sign-to-text', name: 'Sign to text', path: '/tools/sign-to-text', purpose: 'Fingerspell ASL or ISL to the camera and get letters and words.', direction: 'understand', initial: 's' },
  { id: 'gesture-emotion', name: 'Gesture and emotion', path: '/tools/gesture-emotion', purpose: 'Show a gesture or expression and hear what it means.', direction: 'understand', initial: 'g' },
]
