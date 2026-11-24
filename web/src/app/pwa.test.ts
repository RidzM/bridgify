import { describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

const seen: { opts?: RegisterSWOptions } = {}
const update = vi.fn(async () => {})
vi.mock('virtual:pwa-register', () => ({ registerSW: (opts: RegisterSWOptions) => { seen.opts = opts; return update } }))

describe('registerPwa', () => {
  it('registers once and offers Reload when a new version is ready', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    const { registerPwa } = await import('./pwa')
    const { useToasts } = await import('@/components/ui/Toast')
    registerPwa()
    registerPwa()
    await vi.waitFor(() => expect(seen.opts?.immediate).toBe(true))
    seen.opts?.onNeedRefresh?.()
    const item = useToasts.getState().items.at(-1)
    expect(item?.text).toBe('A new version is ready')
    expect(item?.action?.label).toBe('Reload')
    item?.action?.run()
    expect(update).toHaveBeenCalledWith(true)
  })
})
