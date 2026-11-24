import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'
import { AppShell } from './AppShell'

const Home = lazy(() => import('@/features/home/HomePage'))
const ToolsIndex = lazy(() => import('@/features/home/ToolsIndex'))
const NotFound = lazy(() => import('./NotFound'))
const TextToSpeech = lazy(() => import('@/features/tts/TextToSpeechPage'))
const SpeechToText = lazy(() => import('@/features/stt/SpeechToTextPage'))
const TextToBraille = lazy(() => import('@/features/braille/TextToBraillePage'))
const BrailleToText = lazy(() => import('@/features/braille/BrailleToTextPage'))
const SignToText = lazy(() => import('@/features/sign-to-text/SignToTextPage'))
const GestureEmotion = lazy(() => import('@/features/gesture-emotion/GestureEmotionPage'))
const TextToSign = lazy(() => import('@/features/text-to-sign/TextToSignPage'))
const Bridge = lazy(() => import('@/features/bridge/BridgePage'))
const Sos = lazy(() => import('@/features/sos/SosPage'))
const BrailleLesson = lazy(() => import('@/features/learn/BrailleLessonPage'))
const SignLesson = lazy(() => import('@/features/learn/SignLessonPage'))
const About = lazy(() => import('@/features/about/AboutPage'))
const Privacy = lazy(() => import('@/features/about/PrivacyPage'))
const Evidence = lazy(() => import('@/features/about/EvidencePage'))
const Credits = lazy(() => import('@/features/about/CreditsPage'))


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
      { path: 'tools/text-to-sign', element: <TextToSign /> },
      { path: 'tools/gesture-emotion', element: <GestureEmotion /> },
      { path: 'bridge', element: <Bridge /> },
      { path: 'bridge/:code', element: <Bridge /> },
      { path: 'sos', element: <Sos /> },
      { path: 'learn/braille/:section', element: <BrailleLesson /> },
      { path: 'learn/sign/:lang/:section', element: <SignLesson /> },
      { path: 'about', element: <About /> },
      { path: 'about/privacy', element: <Privacy /> },
      { path: 'about/evidence', element: <Evidence /> },
      { path: 'about/credits', element: <Credits /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
