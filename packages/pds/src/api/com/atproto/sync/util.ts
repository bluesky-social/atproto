import { InvalidRequestError } from '@atproto/xrpc-server'
import {
  AccountStatus,
  ActorAccount,
} from '../../../../account-manager/helpers/account'
import AppContext from '../../../../context'

export const assertRepoAvailability = async (
  ctx: AppContext,
  did: string,
  isAdminOrSelf: boolean,
): Promise<ActorAccount> => {
  const account = await ctx.accountManager.getAccount(did, {
    includeDeactivated: true,
    includeTakenDown: true,
  })
  if (!account) {
    throw new InvalidRequestError(
      `Could not find repo for DID: ${did}`,
      'RepoNotFound',
    )
  }
  if (isAdminOrSelf) {
    return account
  }
  if (account.takedownRef) {
    throw new InvalidRequestError(
      `Repo has been takendown: ${did}`,
      'RepoTakendown',
    )
  }
  if (account.deactivatedAt) {
    throw new InvalidRequestError(
      `Repo has been deactivated: ${did}`,
      'RepoDeactivated',
    )
  }
  return account
}

export const formatAccountStatus = (account: {
  takedownRef: string | null
  deactivatedAt: string | null
}): {
  active: boolean
  status?: AccountStatus
} => {
  let status: AccountStatus | undefined = undefined
  if (account.takedownRef) {
    status = AccountStatus.Takendown
  } else if (account.deactivatedAt) {
    status = AccountStatus.Deactivated
  }
  const active = !status
  return {
    active,
    status,
  }
}
