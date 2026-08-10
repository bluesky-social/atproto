import { useEffect, useRef, useState } from 'react'

export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  const valueRef = useRef(value)
  const lastUpdateRef = useRef(Date.now())

  useEffect(() => {
    const now = Date.now()
    const timeSinceLastUpdate = now - lastUpdateRef.current
    if (
      timeSinceLastUpdate >= delay ||
      delay === 0 ||
      value === valueRef.current
    ) {
      setDebouncedValue(value)
      lastUpdateRef.current = now
      valueRef.current = value
    } else {
      const timeout = setTimeout(() => {
        setDebouncedValue(value)
        lastUpdateRef.current = Date.now()
        valueRef.current = value
      }, delay - timeSinceLastUpdate)

      return () => clearTimeout(timeout)
    }
  }, [value, delay])

  return debouncedValue
}
