import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function AboutLayout({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-10 pt-6 md:px-8 lg:pt-12">
      <h1>{title}</h1>
      {intro && <p className="mt-2 text-lg text-ink-muted">{intro}</p>}
      <div className="mt-8 flex flex-col gap-8 [&_h2]:mb-2 [&_li]:mt-1.5 [&_p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </div>
  )
}
