import { ShieldCheck, Server } from 'lucide-react'

export function PrivacyStrip({ where, detail }: { where: 'device' | 'server'; detail: string }) {
  const Icon = where === 'device' ? ShieldCheck : Server
  return (
    <p className="flex max-w-none items-center gap-2 text-sm text-ink-muted">
      <Icon aria-hidden size={18} className={where === 'device' ? 'text-ok' : 'text-ink-muted'} />
      <span>{detail}</span>
    </p>
  )
}
