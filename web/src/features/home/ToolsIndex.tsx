import { ToolDirectory } from './ToolDirectory'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

export default function ToolsIndex() {
  useDocumentTitle('Tools')
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-6">
      <h1 className="mb-8">Tools</h1>
      <ToolDirectory />
    </div>
  )
}
