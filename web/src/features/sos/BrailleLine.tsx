import { useMemo } from 'react'
import { BrailleCell } from '@/components/shell/BrailleCell'
import { charToDots } from '@/engines/braille/cells'
import { translateGrade1 } from '@/engines/braille/grade1'

/**
 * Text as Grade 1 braille cells, computed on the device (no network), with words kept whole
 * when the line wraps. Dot numbers are left out: this is for showing, not for learning.
 */
export function BrailleLine({ text, size = 18, className = '' }: { text: string; size?: number; className?: string }) {
  const words = useMemo(() => translateGrade1(text).unicode.split(/⠀+|\s+/).filter(Boolean), [text])
  return (
    <div role="img" aria-label="Braille, Grade 1" className={`flex flex-wrap gap-x-[0.9em] gap-y-2 ${className}`} style={{ fontSize: size }}>
      {words.map((w, i) => (
        <span key={i} className="inline-flex gap-[0.2em]">
          {[...w].map((ch, j) => <BrailleCell key={j} dots={charToDots(ch)} size={size} />)}
        </span>
      ))}
    </div>
  )
}
