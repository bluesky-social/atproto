import { HTMLAttributes } from 'react'

import { Account } from '../backend-data'

export type AccountIdentifierProps = {
  account: Account
}

export function AccountIdentifier({
  account,
  ...attrs
}: AccountIdentifierProps & HTMLAttributes<Element>) {
  return (
    <b {...attrs}>
      {account.preferred_username || account.email || account.sub}
    </b>
  )
}
