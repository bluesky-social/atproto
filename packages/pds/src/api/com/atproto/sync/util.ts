import type { AtIdentifierString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorAccount } from '../../../../account-manager/helpers/account.js'
import type { AppContext } from '../../../../context.js'

export const assertRepoAvailability = async (
  ctx: AppContext,
  handleOrDid: AtIdentifierString,
  isAdminOrSelf: boolean,
): Promise<ActorAccount> => {
  const account = await ctx.accountManager.getAccount(handleOrDid, {
    includeDeactivated: true,
    includeTakenDown: true,
  })
  if (!account) {
    throw new InvalidRequestError(
      `Could not find repo for DID: ${handleOrDid}`,
      'RepoNotFound',
    )
  }
  if (isAdminOrSelf) {
    return account
  }
  if (account.takedownRef) {
    throw new InvalidRequestError(
      `Repo has been takendown: ${handleOrDid}`,
      'RepoTakendown',
    )
  }
  if (account.deactivatedAt) {
    throw new InvalidRequestError(
      `Repo has been deactivated: ${handleOrDid}`,
      'RepoDeactivated',
    )
  }
  return account
}
