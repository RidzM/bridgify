import type { LucideIcon } from 'lucide-react'
import { House, Volume2, GripVertical, Hand, Captions, Keyboard, ScanLine, Smile, MessagesSquare, BookOpen, GraduationCap } from 'lucide-react'
import type { ToolId } from './tools'

export interface NavItem { label: string; to: string; icon: LucideIcon; tool?: ToolId }
export interface NavGroup { label?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { items: [{ label: 'Home', to: '/', icon: House }] },
  {
    label: 'Say it',
    items: [
      { label: 'Text to speech', to: '/tools/text-to-speech', icon: Volume2, tool: 'text-to-speech' },
      { label: 'Text to braille', to: '/tools/text-to-braille', icon: GripVertical, tool: 'text-to-braille' },
      { label: 'Text to sign', to: '/tools/text-to-sign', icon: Hand, tool: 'text-to-sign' },
    ],
  },
  {
    label: 'Understand it',
    items: [
      { label: 'Speech to text', to: '/tools/speech-to-text', icon: Captions, tool: 'speech-to-text' },
      { label: 'Braille to text', to: '/tools/braille-to-text', icon: Keyboard, tool: 'braille-to-text' },
      { label: 'Sign to text', to: '/tools/sign-to-text', icon: ScanLine, tool: 'sign-to-text' },
      { label: 'Gesture and emotion', to: '/tools/gesture-emotion', icon: Smile, tool: 'gesture-emotion' },
    ],
  },
  { label: 'Together', items: [{ label: 'Bridge', to: '/bridge', icon: MessagesSquare }] },
  {
    label: 'Learn',
    items: [
      { label: 'Braille', to: '/learn/braille/alphabet', icon: BookOpen },
      { label: 'Sign language', to: '/learn/sign/isl/alphabet', icon: GraduationCap },
    ],
  },
]
