import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'
import { AppShell } from './AppShell'
import { ComingSoon } from './ComingSoon'

const Home = lazy(() => import('@/features/home/HomePage'))
const ToolsIndex = lazy(() => import('@/features/home/ToolsIndex'))
const NotFound = lazy(() => import('./NotFound'))

const soon = (title: string) => <ComingSoon title={title} />

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tools', element: <ToolsIndex /> },
      { path: 'tools/text-to-speech', element: soon('Text to speech') },
      { path: 'tools/speech-to-text', element: soon('Speech to text') },
      { path: 'tools/text-to-braille', element: soon('Text to braille') },
      { path: 'tools/braille-to-text', element: soon('Braille to text') },
      { path: 'tools/sign-to-text', element: soon('Sign to text') },
      { path: 'tools/text-to-sign', element: soon('Text to sign') },
      { path: 'tools/gesture-emotion', element: soon('Gesture and emotion') },
      { path: 'bridge', element: soon('Bridge') },
      { path: 'bridge/:code', element: soon('Bridge') },
      { path: 'sos', element: soon('SOS') },
      { path: 'learn/braille/:section', element: soon('Braille tutorial') },
      { path: 'learn/sign/:lang/:section', element: soon('Sign language tutorial') },
      { path: 'about', element: soon('About') },
      { path: 'about/privacy', element: soon('Privacy') },
      { path: 'about/evidence', element: soon('Evidence') },
      { path: 'about/credits', element: soon('Credits') },
      { path: '*', element: <NotFound /> },
    ],
  },
])
