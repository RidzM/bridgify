import { BrailleCell } from '@/components/shell/BrailleCell'
import { charToDots, isBraille } from '@/engines/braille/cells'

/** Braille cells as raised/flat dots with their dot numbers underneath. */
export function DotGrid({ unicode, size = 30 }: { unicode: string; size?: number }) {
  const cells = [...unicode]
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-4" aria-label="Braille cells">
      {cells.map((ch, i) => {
        if (ch === '\n') return <li key={i} className="basis-full" aria-hidden />
        const dots = isBraille(ch) ? charToDots(ch) : []
        const blank = !dots.length
        return (
          <li key={i} className="flex w-9 flex-col items-center gap-1" aria-label={blank ? 'space' : `dots ${dots.join(' ')}`}>
            {blank ? <span className="h-[39px] w-3" /> : <BrailleCell dots={dots} size={size} />}
            <span className="text-[0.75rem] text-ink-muted tabular" aria-hidden>{blank ? '' : dots.join('')}</span>
          </li>
        )
      })}
    </ul>
  )
}
