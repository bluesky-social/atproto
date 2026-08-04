import { useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useDateAgo } from '#/hooks/use-date-ago.ts'

export function DateAgo({ date }: { date: Date | string }): ReactNode {
  const { t } = useLingui()
  const bucket = useDateAgo(date)

  switch (bucket.type) {
    case 'seconds':
      return t`just now`
    case 'minutes': {
      const deltaMinutes = bucket.count
      return deltaMinutes === 1
        ? t`1 minute ago`
        : t`${deltaMinutes} minutes ago`
    }
    case 'hours': {
      const deltaHours = bucket.count
      return deltaHours === 1 ? t`1 hour ago` : t`${deltaHours} hours ago`
    }
    case 'days': {
      const deltaDays = bucket.count
      return deltaDays === 1 ? t`yesterday` : t`${deltaDays} days ago`
    }
  }
}
