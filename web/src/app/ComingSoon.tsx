import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function ComingSoon({ title }: { title: string }) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-6">
      <h1>{title}</h1>
      <p className="mt-3 text-ink-muted">This part is being built. Try another tool from the home page.</p>
      <Link to="/" className="mt-6 inline-flex min-h-11 items-center">Go to home</Link>
    </div>
  )
}
