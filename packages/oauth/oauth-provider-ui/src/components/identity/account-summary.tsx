import type { JSX, ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
import { AccountAvatar } from './account-avatar.tsx'
import { AccountIdentifier } from './account-identifier.tsx'
import { AccountName } from './account-name.tsx'

export type AccountSummaryProps = Override<
  JSX.IntrinsicElements['div'],
  {
    account: Account
  }
>

export function AccountSummary({
  account,

  // div
  className,
  children,
  ...props
}: AccountSummaryProps): ReactNode {
  return (
    <div
      className={cn(
        'flex max-w-full flex-col items-center justify-start gap-2',
        className,
      )}
      {...props}
    >
      <AccountAvatar account={account} size="3xl" className="max-w-full" />
      {account.name && (
        <AccountName
          account={account}
          className="max-w-full truncate text-xl font-medium"
        />
      )}
      <AccountIdentifier
        account={account}
        className="text-muted-foreground max-w-full truncate text-base"
      />
      {children}
    </div>
  )
}
