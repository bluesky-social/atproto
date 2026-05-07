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
        'flex min-h-full max-w-full flex-col items-center justify-start gap-1',
        className,
      )}
      {...props}
    >
      <AccountImage account={account} size="3xl" className="mb-4 max-w-full" />
      {account.name && (
        <AccountName
          account={account}
          className="text-text-default max-w-full truncate text-xl font-medium"
        />
      )}
      <AccountIdentifier
        account={account}
        className="text-md text-text-light max-w-full truncate"
      />
    </div>
  )
}
