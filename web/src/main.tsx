import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import '@fontsource/atkinson-hyperlegible-next/latin-400.css'
import '@fontsource/atkinson-hyperlegible-next/latin-500.css'
import '@fontsource/atkinson-hyperlegible-next/latin-600.css'
import './index.css'
import { router } from './app/router'

// OpenDyslexic loads only when Dyslexia mode is chosen.
const loadDyslexiaFont = () => {
  if (document.documentElement.dataset.mode === 'dyslexia') void import('@fontsource/opendyslexic/400.css')
}
loadDyslexiaFont()
new MutationObserver(loadDyslexiaFont).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
