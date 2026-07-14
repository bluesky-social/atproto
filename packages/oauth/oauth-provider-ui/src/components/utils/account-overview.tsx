import { clsx } from 'clsx'
import type { JSX, ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import type { Override } from '#/lib/util.ts'
import { AccountIdentifier } from './account-identifier.tsx'
import { AccountImage } from './account-image.tsx'
import { AccountName } from './account-name.tsx'

export type AccountOverviewProps = Override<
  JSX.IntrinsicElements['div'],
  {
    account: Account
  }
>

export function AccountOverview({
  account,

  // div
  className,
  children,
  ...props
}: AccountOverviewProps): ReactNode {
  return (
    <div
      className={clsx(
        'flex max-w-full flex-col items-center justify-start gap-2',
        className,
      )}
      {...props}
    >
      <AccountImage account={account} size="3xl" className="max-w-full" />
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
      {children}
    </div>
  )
}
