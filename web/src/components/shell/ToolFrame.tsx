import type { ReactNode } from 'react'
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
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-8 pt-6 md:px-8 md:pt-10">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1>{title}</h1>
          <p className="mt-1.5 text-ink-muted">{purpose}</p>
        </div>
        <PrivacyStrip {...privacy} />
      </div>
      {children}
      {aside && <div className="focus-dim mt-8">{aside}</div>}
    </div>
  )
}
