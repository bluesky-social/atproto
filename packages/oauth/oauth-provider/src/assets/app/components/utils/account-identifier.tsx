import { JSX } from 'react'
import { Account } from '../../backend-types.ts'
import { Override } from '../../lib/util.ts'

export type AccountIdentifierProps = Override<
  Omit<JSX.IntrinsicElements['b'], 'children'>,
  {
    account: Account
  }
>

export function AccountIdentifier({
  account,

  // b
  ...props
}: AccountIdentifierProps) {
  return (
    <b {...props}>
      {account.preferred_username || account.email || account.sub}
    </b>
  )
}
