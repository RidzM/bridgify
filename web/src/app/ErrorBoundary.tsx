import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-[640px] px-4 py-16">
        <h1>This page stopped working</h1>
        <p className="mt-3 text-ink-muted">Something went wrong while loading it. Your settings are safe.</p>
        <button type="button" className="mt-6 min-h-11 rounded-[var(--radius-control)] bg-brand px-4 text-brand-ink" onClick={() => location.reload()}>
          Reload the page
        </button>
      </div>
    )
  }
}
