import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  side: 'left' | 'right'
  title: string
  description?: string
  children: ReactNode
}

export function Sheet({ open, onOpenChange, side, title, description, children }: SheetProps) {
  const pos = side === 'left' ? 'left-0 border-r data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full' : 'right-0 border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full'
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-ink/30 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className={`fixed top-0 z-50 flex h-dvh w-[min(26rem,100vw)] flex-col border-line bg-surface text-ink shadow-[var(--shadow-sheet)] transition-transform duration-200 ease-out ${pos}`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="text-xl font-bold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-ink-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-2" aria-label={`Close ${title.toLowerCase()}`}>
              <X aria-hidden size={22} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
