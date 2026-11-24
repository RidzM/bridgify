/** A fingerspelling picture. One-colour SVG diagrams take the theme's ink colour (works in all 12 modes). */
export function LetterGlyph({ media, className = '', alt = '' }: { media: { type: string; src: string } | null; className?: string; alt?: string }) {
  if (!media) return null
  if (media.type === 'svg') {
    const url = `url("${media.src}")`
    return (
      <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        className={`block bg-ink [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] ${className}`}
        style={{ WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
    )
  }
  return <img src={media.src} alt={alt} loading="lazy" className={`object-contain ${className}`} />
}
