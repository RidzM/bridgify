/** A fingerspelling picture: a white, outlined hand illustration (SVG) or a photo. Readable in all 12 modes. */
export function LetterGlyph({ media, className = '', alt = '' }: { media: { type: string; src: string } | null; className?: string; alt?: string }) {
  if (!media) return null
  return <img src={media.src} alt={alt} aria-hidden={alt ? undefined : true} loading="lazy" decoding="async" className={`object-contain ${className}`} />
}
