import { create } from 'zustand'
import { useEffect } from 'react'

interface ToastItem { id: number; text: string; action?: { label: string; run: () => void } }
interface ToastState { items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; dismiss: (id: number) => void }

let seq = 0
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items.slice(-2), { ...t, id: ++seq }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

export const toast = (text: string, action?: ToastItem['action']) => useToasts.getState().push({ text, action })

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss)
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), item.action ? 8000 : 4000)
    return () => clearTimeout(t)
  }, [item, dismiss])
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-line-strong bg-surface px-4 py-3 text-ink shadow-[var(--shadow-sheet)]">
      <span>{item.text}</span>
      {item.action && (
        <button type="button" className="min-h-11 rounded-[var(--radius-control)] px-3 font-bold text-brand underline" onClick={() => { item.action!.run(); dismiss(item.id) }}>
          {item.action.label}
        </button>
      )}
    </div>
  )
}

export function ToastRegion() {
  const items = useToasts((s) => s.items)
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 [&>*]:pointer-events-auto">
      {items.map((i) => <ToastRow key={i.id} item={i} />)}
    </div>
  )
}
