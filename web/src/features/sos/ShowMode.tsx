import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { RotateCw, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LazySigns } from './LazySigns'
import { BrailleLine } from './BrailleLine'
import type { SosCard } from './cards'

interface Props { card: SosCard | null; onClose: () => void; onSpeak: (card: SosCard) => void }

/**
 * A card filling the whole screen, for holding up to someone. Sizes follow the shorter side of
 * the screen, so it works upright or sideways. "Turn text around" flips it for a person sitting
 * across the table when the phone lies flat between you.
 */
export function ShowMode({ card, onClose, onSpeak }: Props) {
  const [flipped, setFlipped] = useState(false)
  const open = card !== null

  useEffect(() => {
    if (!open) return
    setFlipped(false)
    // Full screen hides the browser bars where that is allowed; it is fine if it isn't.
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    return () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}) }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-0 z-[80] flex flex-col bg-surface text-ink outline-none">
          {card && (
            <>
              <Dialog.Title className="sr-only">Shown full screen</Dialog.Title>
              <div
                className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-[3.5vmin] overflow-auto px-[5vmin] py-[4vmin] text-center ${flipped ? 'rotate-180' : ''}`}
              >
                <Dialog.Description lang="en" className="max-w-[20ch] font-semibold leading-[1.08] tracking-[-0.015em] text-[clamp(2.25rem,8.5vmin,7.5rem)] [text-wrap:balance]">
                  {card.text}
                </Dialog.Description>
                {card.extra && <p className="max-w-[28ch] font-semibold leading-tight text-[clamp(1.75rem,6vmin,4.5rem)] tabular">{card.extra}</p>}
                {card.hi && <p lang="hi" className="max-w-[32ch] leading-snug text-ink-muted text-[clamp(1.25rem,4vmin,2.75rem)]">{card.hi}</p>}
                <BrailleLine text={card.text} size={28} className="justify-center" />
                <div className="w-full max-w-md"><LazySigns text={card.text} lang="isl" autoPlay compact /></div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line px-4 py-3">
                <Button size="lg" onClick={() => onSpeak(card)} icon={<Volume2 aria-hidden size={20} />}>Speak</Button>
                <Button size="lg" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)} icon={<RotateCw aria-hidden size={18} />}>Turn text around</Button>
                <Dialog.Close render={<Button size="lg" variant="primary" icon={<X aria-hidden size={20} />} />}>Close</Dialog.Close>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
