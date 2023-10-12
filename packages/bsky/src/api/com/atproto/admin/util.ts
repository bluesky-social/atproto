import AppContext from '../../../../context'
import {
  RepoView,
  RepoViewDetail,
  UserAccountView,
} from '../../../../lexicon/types/com/atproto/admin/defs'

export const getPdsAccountInfo = async (
  ctx: AppContext,
  did: string,
): Promise<UserAccountView | null> => {
  try {
    const agent = await ctx.pdsAdminAgent(did)
    const res = await agent.api.com.atproto.admin.getUserAccountInfo({ did })
    return res.data
  } catch (err) {
    return null
  }
}

export const getPdsAccountInfos = async (
  ctx: AppContext,
  dids: string[],
): Promise<Record<string, UserAccountView>> => {
  const unique = [...new Set(dids)]
  const infos = await Promise.all(
    unique.map((did) => getPdsAccountInfo(ctx, did)),
  )
  return infos.reduce((acc, cur) => {
    if (cur) {
      acc[cur.did] = cur
    }
    return acc
  }, {} as Record<string, UserAccountView>)
}

export const addAccountInfoToRepoViewDetail = (
  repoView: RepoViewDetail,
  accountInfo: UserAccountView | null,
): RepoViewDetail => {
  if (!accountInfo) return repoView
  return {
    ...repoView,
    email: accountInfo.email,
    invitedBy: accountInfo.invitedBy,
    invitesDisabled: accountInfo.invitesDisabled,
    inviteNote: accountInfo.inviteNote,
    invites: accountInfo.invites,
  }
}

export const addAccountInfoToRepoView = (
  repoView: RepoView,
  accountInfo: UserAccountView | null,
): RepoView => {
  if (!accountInfo) return repoView
  return {
    ...repoView,
    email: accountInfo.email,
    invitedBy: accountInfo.invitedBy,
    invitesDisabled: accountInfo.invitesDisabled,
    inviteNote: accountInfo.inviteNote,
  }
}
