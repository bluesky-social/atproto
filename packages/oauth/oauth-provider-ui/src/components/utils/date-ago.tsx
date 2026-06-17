import { ReactNode } from 'react'
import { useDateAgo } from '#/hooks/use-date-ago.ts'

export function DateAgo({ date }: { date: Date | string }): ReactNode {
  const lastUsedAgo = useDateAgo(date)
  return lastUsedAgo
}
