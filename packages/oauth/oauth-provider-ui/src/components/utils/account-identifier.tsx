import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'

export type AccountIdentifierProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    account: Account
  }
>

export function AccountIdentifier({
  account,

  // span
  ...props
}: AccountIdentifierProps) {
  const { t } = useLingui()
  return (
    <span {...props} aria-label={t`Account identifier`}>
      {account.preferred_username || account.email || account.sub}
    </span>
  )
}
