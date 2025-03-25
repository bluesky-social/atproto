import { Account } from '#/api'

import { sanitizeHandle } from '#/util/sanitizeHandle'

export function getAccountName(account: Account): string {
  return (
    account.account.name ||
    sanitizeHandle(account.account.preferred_username) ||
    account.account.sub
  )
}
