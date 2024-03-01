import AppContext from '../../context'
import {
  RepoView,
  RepoViewDetail,
  AccountView,
} from '../../lexicon/types/com/atproto/admin/defs'

export const getPdsAccountInfo = async (
  ctx: AppContext,
  did: string,
): Promise<AccountView | null> => {
  const agent = ctx.pdsAgent
  if (!agent) return null
  const auth = await ctx.pdsAuth()
  if (!auth) return null
  try {
    const res = await agent.api.com.atproto.admin.getAccountInfo({ did }, auth)
    return res.data
  } catch {
    return null
  }
}

export const addAccountInfoToRepoViewDetail = (
  repoView: RepoViewDetail,
  accountInfo: AccountView | null,
  includeEmail = false,
): RepoViewDetail => {
  if (!accountInfo) return repoView
  return {
    ...repoView,
    email: includeEmail ? accountInfo.email : undefined,
    invitedBy: accountInfo.invitedBy,
    invitesDisabled: accountInfo.invitesDisabled,
    inviteNote: accountInfo.inviteNote,
    invites: accountInfo.invites,
    emailConfirmedAt: accountInfo.emailConfirmedAt,
  }
}

export const addAccountInfoToRepoView = (
  repoView: RepoView,
  accountInfo: AccountView | null,
  includeEmail = false,
): RepoView => {
  if (!accountInfo) return repoView
  return {
    ...repoView,
    email: includeEmail ? accountInfo.email : undefined,
    invitedBy: accountInfo.invitedBy,
    invitesDisabled: accountInfo.invitesDisabled,
    inviteNote: accountInfo.inviteNote,
  }
}
