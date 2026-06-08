import { useEffect } from 'react'
import { useStableCallback } from './use-stable-callback.ts'

export function useEscapeKey(handler: (event: KeyboardEvent) => void) {
  const cb = useStableCallback(handler)

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cb(event)
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [cb])
}
