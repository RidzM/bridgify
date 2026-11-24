import { Link } from 'react-router'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export function ComingSoon({ title }: { title: string }) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto max-w-[1080px] px-4 pb-8 pt-10 md:px-8">
      <h1>{title}</h1>
      <p className="mt-2 text-ink-muted">This tool is being built. The others in the menu work now.</p>
      <Link to="/" className="mt-4 inline-flex min-h-11 items-center">Back to home</Link>
    </div>
  )
}
