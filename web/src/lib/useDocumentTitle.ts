import { useEffect } from 'react'
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Bridgify` : 'Bridgify: speak your way, be heard every way'
  }, [title])
}
