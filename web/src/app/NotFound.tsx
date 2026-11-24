import { Link } from 'react-router-dom'
import { TOOLS } from '@/lib/tools'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 md:px-6">
      <h1>That page doesn't exist</h1>
      <p className="mt-3 text-ink-muted">Pick a tool instead:</p>
      <ul className="mt-4 space-y-1">
        {TOOLS.map((t) => <li key={t.id}><Link to={t.path} className="inline-flex min-h-11 items-center">{t.name}</Link></li>)}
      </ul>
    </div>
  )
}
