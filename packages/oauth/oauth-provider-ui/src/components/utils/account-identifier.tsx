import { useLingui } from '@lingui/react/macro'
import { JSX } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Override } from '#/lib/util.ts'
import { Handle } from './handle.tsx'

export type AccountIdentifierProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    account: Account
  }
>

export function AccountIdentifier({
  account,

  // span
  'aria-label': ariaLabel,
  ...props
}: AccountIdentifierProps) {
  const { t } = useLingui()

  const handle = account.handle
  if (handle) {
    return <Handle handle={handle} aria-label={ariaLabel} {...props} />
  }

  return (
    <span {...props} aria-label={ariaLabel ?? t`Account identifier`}>
      {account.did}
    </span>
  )
}
