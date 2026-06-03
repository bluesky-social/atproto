import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { AccountIdentifier } from './account-identifier.js'

export type AccountNameProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    account: Account
  }
>

export function AccountName({
  account,

  // span
  'aria-label': ariaLabel,
  ...props
}: AccountNameProps) {
  const { t } = useLingui()

  if (account.name) {
    return (
      <span {...props} aria-label={ariaLabel ?? t`Account name`}>
        {account.name}
      </span>
    )
  }

  return (
    <AccountIdentifier {...props} account={account} aria-label={ariaLabel} />
  )
}
