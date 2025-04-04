import { Account } from '#/api'
import { sanitizeHandle } from '#/util/sanitizeHandle'

export function getAccountName(account: Account): string {
  return (
    account.name || sanitizeHandle(account.preferred_username) || account.sub
  )
}
