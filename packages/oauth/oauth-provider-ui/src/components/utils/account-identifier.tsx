import { useLingui } from '@lingui/react/macro'
import { AtIcon } from '@phosphor-icons/react'
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
      {account.preferred_username ? (
        <>
          <AtIcon weight="bold" className="inline-block" aria-hidden />
          {account.preferred_username}
        </>
      ) : (
        account.sub
      )}
    </span>
  )
}
