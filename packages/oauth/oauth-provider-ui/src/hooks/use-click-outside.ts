import { RefObject, useEffect } from 'react'

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: (event: MouseEvent) => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (
        !event.defaultPrevented &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        handler(event)
      }
    }

    document.addEventListener('mousedown', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
    }
  }, [ref, handler])
}
