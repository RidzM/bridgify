import type { Dot } from '@/engines/braille/cells'

const POS: Record<Dot, [number, number]> = { 1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [1, 0], 5: [1, 1], 6: [1, 2] }

interface Props {
  dots: readonly number[]
  size?: number
  /** Accessible label; omit to hide from assistive tech (decorative use). */
  label?: string
  className?: string
  /** Index used to stagger the raise animation on the home demo. */
  raiseIndex?: number
}

export function BrailleCell({ dots, size = 28, label, className = '', raiseIndex }: Props) {
  const r = size * 0.13
  const gx = size * 0.32
  const gy = size * 0.3
  const ox = size * 0.34
  const oy = size * 0.2
  return (
    <svg
      width={size * 1.0}
      height={size * 1.3}
      viewBox={`0 0 ${size} ${size * 1.3}`}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {([1, 2, 3, 4, 5, 6] as Dot[]).map((d) => {
        const [c, row] = POS[d]
        const on = dots.includes(d)
        return (
          <circle
            key={d}
            cx={ox + c * gx}
            cy={oy + row * gy * 1.25}
            r={r}
            className={on ? 'dot-raised' : 'dot-flat'}
            style={on && raiseIndex !== undefined ? { animationDelay: `${raiseIndex * 30 + d * 12}ms` } : undefined}
          />
        )
      })}
    </svg>
  )
}
