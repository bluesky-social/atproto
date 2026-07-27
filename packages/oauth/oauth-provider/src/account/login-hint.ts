import { isAtprotoDid } from '@atproto/did'
import type { AccountManager } from './account-manager.js'

/**
 * Computes the user-facing value for a `login_hint` request parameter. Clients
 * may provide a DID (typically when re-authenticating an account they already
 * know), which users are unlikely to recognize as their own. When the DID
 * belongs to an account on this server, return that account's current handle
 * for display instead.
 */
export async function resolveLoginHint(
  hint: string | undefined,
  accountManager: Pick<AccountManager, 'getAccount'>,
): Promise<string | undefined> {
  if (hint && isAtprotoDid(hint)) {
    const account = await accountManager.getAccount(hint).then(
      (result) => result.account,
      // Unknown account: fall back to displaying the hint as-is
      () => null,
    )
    if (account?.handle) return account.handle
  }

  return hint
}
