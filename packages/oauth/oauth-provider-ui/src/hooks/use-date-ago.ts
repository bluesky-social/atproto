import { useEffect, useMemo, useState } from 'react'

export type DateAgoBucket =
  | { type: 'seconds'; count: number }
  | { type: 'minutes'; count: number }
  | { type: 'hours'; count: number }
  | { type: 'days'; count: number }

export function useDateAgo(date: Date | string): DateAgoBucket {
  const delta = useDateDelta(date)
  const todayTimestamp = useTodayTimestamp()

  return useMemo(() => {
    const deltaSeconds = Math.floor(delta / 1000)
    if (deltaSeconds < 60) return { type: 'seconds', count: deltaSeconds }

    const deltaMinutes = Math.floor(deltaSeconds / 60)
    if (deltaMinutes < 60) return { type: 'minutes', count: deltaMinutes }

    const deltaHours = Math.floor(deltaMinutes / 60)
    if (deltaHours < 24) return { type: 'hours', count: deltaHours }

    const deltaDays = Math.floor(deltaHours / 24)
    return { type: 'days', count: deltaDays }
  }, [delta, todayTimestamp, date])
}

function useDateDelta(input: Date | string) {
  const date = useMemo(() => new Date(input), [input])
  const [delta, setDelta] = useState(() => Date.now() - date.getTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setDelta(Date.now() - date.getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [date])

  return delta
}

function useTodayTimestamp() {
  const [todayTimestamp, setTodayTimestamp] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setTodayTimestamp(
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
      )
    }, 60 * 1000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  return todayTimestamp
}
