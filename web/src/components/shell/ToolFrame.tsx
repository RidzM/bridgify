import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PrivacyStrip } from './PrivacyStrip'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

interface Props {
  title: string
  purpose: string
  privacy: { where: 'device' | 'server'; detail: string }
  children: ReactNode
  aside?: ReactNode
}

export function ToolFrame({ title, purpose, privacy, children, aside }: Props) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
      <Link to="/" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-ink-muted no-underline hover:text-ink">
        <ArrowLeft aria-hidden size={18} /> Back to home
      </Link>
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1>{title}</h1>
          <p className="mt-2 text-lg text-ink-muted">{purpose}</p>
        </div>
        <PrivacyStrip {...privacy} />
      </div>
      {children}
      {aside && <div className="focus-dim mt-8">{aside}</div>}
    </div>
  )
}
