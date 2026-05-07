import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { getAccountHandle } from './account-handle'

export type AccountNameProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    account: Account
  }
>

export function AccountName({
  account,

  // span
  ...props
}: AccountNameProps) {
  const { t } = useLingui()
  return (
    <span {...props} aria-label={t`Account name`}>
      {account.name || getAccountHandle(account) || account.sub}
    </span>
  )
}
