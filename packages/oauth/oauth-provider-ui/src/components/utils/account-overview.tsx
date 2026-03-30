import { clsx } from 'clsx'
import { JSX, ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { AccountIdentifier } from './account-identifier.tsx'
import { AccountImage } from './account-image.tsx'
import { AccountName } from './account-name.tsx'

export type AccountOverviewProps = Override<
  {
    account: Account
  },
  JSX.IntrinsicElements['div']
>

export function AccountOverview({
  account,

  // div
  className,
  ...props
}: AccountOverviewProps): ReactNode {
  return (
    <div
      className={clsx(
        'flex min-h-full max-w-full flex-col items-center justify-start gap-4',
        className,
      )}
      {...props}
    >
      <AccountImage account={account} size="3xl" className="max-w-full" />
      <AccountName
        account={account}
        className="max-w-full truncate text-lg font-medium text-slate-900 dark:text-white"
      />
      <AccountIdentifier
        account={account}
        className="text-md max-w-full truncate text-slate-700 dark:text-slate-300"
      />
    </div>
  )
}
