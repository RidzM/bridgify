import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'
import { AppShell } from './AppShell'
import { ComingSoon } from './ComingSoon'

const Home = lazy(() => import('@/features/home/HomePage'))
const ToolsIndex = lazy(() => import('@/features/home/ToolsIndex'))
const NotFound = lazy(() => import('./NotFound'))
const TextToSpeech = lazy(() => import('@/features/tts/TextToSpeechPage'))
const SpeechToText = lazy(() => import('@/features/stt/SpeechToTextPage'))
const TextToBraille = lazy(() => import('@/features/braille/TextToBraillePage'))
const BrailleToText = lazy(() => import('@/features/braille/BrailleToTextPage'))
const SignToText = lazy(() => import('@/features/sign-to-text/SignToTextPage'))
const GestureEmotion = lazy(() => import('@/features/gesture-emotion/GestureEmotionPage'))

const soon = (title: string) => <ComingSoon title={title} />

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tools', element: <ToolsIndex /> },
      { path: 'tools/text-to-speech', element: <TextToSpeech /> },
      { path: 'tools/speech-to-text', element: <SpeechToText /> },
      { path: 'tools/text-to-braille', element: <TextToBraille /> },
      { path: 'tools/braille-to-text', element: <BrailleToText /> },
      { path: 'tools/sign-to-text', element: <SignToText /> },
      { path: 'tools/text-to-sign', element: soon('Text to sign') },
      { path: 'tools/gesture-emotion', element: <GestureEmotion /> },
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
