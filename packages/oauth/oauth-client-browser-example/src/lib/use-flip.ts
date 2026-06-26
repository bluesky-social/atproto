import { useEffect, useState } from 'react'

export function useFlip(
  value: boolean,
  { delay = 0 }: { delay?: number } = {},
): boolean {
  const [start] = useState(Date.now())
  const [flipped, setFlipped] = useState(delay === 0 ? value : false)
  useEffect(() => {
    if (value) {
      setTimeout(setFlipped, Math.max(0, delay - (Date.now() - start)), true)
    }
  }, [value, delay])
  return flipped
}
