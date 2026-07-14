import { useEffect, useState } from 'react'
import { useStableCallback } from './use-stable-callback.ts'

export function useCountdown(initial: number) {
  const [remaining, setRemaining] = useState(fixCountdownValue(initial))

  useEffect(() => {
    if (remaining > 0) {
      const timer = setTimeout(() => {
        setRemaining(remaining - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [remaining])

  const setRemainingSafe = useStableCallback((value: number = initial) => {
    setRemaining(fixCountdownValue(value))
  })

  return [Math.max(0, remaining), setRemainingSafe] as const
}

function fixCountdownValue(input: number) {
  if (input < 0 || Number.isNaN(input)) {
    return 0
  }
  return Math.floor(input)
}
