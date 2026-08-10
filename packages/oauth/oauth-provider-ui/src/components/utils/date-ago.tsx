import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { useDateAgo } from '#/hooks/use-date-ago.ts'

export function DateAgo({ date }: { date: Date | string }): ReactNode {
  const { t } = useLingui()
  const bucket = useDateAgo(date)

  switch (bucket.type) {
    case 'seconds':
      return t`just now`
    case 'minutes':
      return t`${plural(bucket.count, {
        one: '# minute ago',
        other: '# minutes ago',
      })}`
    case 'hours':
      return t`${plural(bucket.count, {
        one: '# hour ago',
        other: '# hours ago',
      })}`
    case 'days':
      return t`${plural(bucket.count, {
        one: 'yesterday',
        other: '# days ago',
      })}`
  }
}
