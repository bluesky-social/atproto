import { RefObject, useEffect } from 'react'
import { useStableCallback } from './use-stable-callback.ts'

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: (event: MouseEvent) => void,
) {
  const cb = useStableCallback(handler)

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (
        !event.defaultPrevented &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        cb(event)
      }
    }

    document.addEventListener('mousedown', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
    }
  }, [ref])
}
