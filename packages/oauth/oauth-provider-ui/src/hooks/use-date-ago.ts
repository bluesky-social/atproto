import { useLingui } from '@lingui/react/macro'
import { useEffect, useMemo, useState } from 'react'

export function useDateAgo(date: Date | string): string {
  const { t } = useLingui()
  const delta = useDateDelta(date)
  const todayTimestamp = useTodayTimestamp()

  const deltaSeconds = Math.floor(delta / 1000)
  if (deltaSeconds < 60) {
    return t`just now`
  }

  const deltaMinutes = Math.floor(deltaSeconds / 60)
  if (deltaMinutes === 1) {
    return t`1 minute ago`
  }
  if (deltaMinutes < 60) {
    return t`${deltaMinutes} minutes ago`
  }

  const deltaHours = Math.floor(deltaMinutes / 60)
  if (deltaHours === 1) {
    return t`1 hour ago`
  }
  if (deltaHours < 24) {
    return t`${deltaHours} hours ago`
  }

  if (deltaHours < 48 && new Date(date).getTime() < todayTimestamp) {
    return t`yesterday`
  }

  const deltaDays = Math.floor(deltaHours / 24)
  return t`${deltaDays} days ago`
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
