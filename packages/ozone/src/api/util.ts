import { InvalidRequestError } from '@atproto/xrpc-server'
import { InputSchema as ReportInput } from '../lexicon/types/com/atproto/moderation/createReport'
import {
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
  REASONAPPEAL,
} from '../lexicon/types/com/atproto/moderation/defs'
import { AccountView } from '../lexicon/types/com/atproto/admin/defs'
import {
  RepoView,
  RepoViewDetail,
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../lexicon/types/tools/ozone/moderation/defs'
import { ModerationEvent } from '../db/schema/moderation_event'
import { ModerationSubjectStatusRow } from '../mod-service/types'
import AppContext from '../context'
import { Member } from '../db/schema/member'
import {
  ROLEADMIN,
  ROLEMODERATOR,
  ROLETRIAGE,
} from '../lexicon/types/tools/ozone/team/defs'
import { ids } from '../lexicon/lexicons'

export const getPdsAccountInfos = async (
  ctx: AppContext,
  dids: string[],
): Promise<Map<string, AccountView | null>> => {
  const results = new Map<string, AccountView | null>()

  const agent = ctx.pdsAgent
  if (!agent) return results

  const auth = await ctx.pdsAuth(ids.ComAtprotoAdminGetAccountInfos)
  if (!auth) return results

  try {
    const res = await agent.com.atproto.admin.getAccountInfos({ dids }, auth)
    res.data.infos.forEach((info) => {
      results.set(info.did, info)
    })
    return results
  } catch {
    return results
  }
}

export const addAccountInfoToRepoViewDetail = (
  repoView: RepoViewDetail,
  accountInfo: AccountView | null,
  includeEmail = false,
): RepoViewDetail => {
  if (!accountInfo) return repoView
  const {
    email,
    deactivatedAt,
    emailConfirmedAt,
    inviteNote,
    invitedBy,
    invites,
    invitesDisabled,
    threatSignatures,
    // pick some duplicate/unwanted details out
    did: _did,
    handle: _handle,
    indexedAt: _indexedAt,
    relatedRecords: _relatedRecords,
    ...otherAccountInfo
  } = accountInfo
  return {
    ...otherAccountInfo,
    ...repoView,
    email: includeEmail ? email : undefined,
    invitedBy,
    invitesDisabled,
    inviteNote,
    invites,
    emailConfirmedAt,
    deactivatedAt,
    threatSignatures,
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
    deactivatedAt: accountInfo.deactivatedAt,
    threatSignatures: accountInfo.threatSignatures,
  }
}

export const getReasonType = (reasonType: ReportInput['reasonType']) => {
  if (reasonTypes.has(reasonType)) {
    return reasonType as NonNullable<ModerationEvent['meta']>['reportType']
  }
  throw new InvalidRequestError('Invalid reason type')
}

export const getEventType = (type: string) => {
  if (eventTypes.has(type)) {
    return type as ModerationEvent['action']
  }
  throw new InvalidRequestError('Invalid event type')
}

export const getReviewState = (reviewState?: string) => {
  if (!reviewState) return undefined
  if (reviewStates.has(reviewState)) {
    return reviewState as ModerationSubjectStatusRow['reviewState']
  }
  throw new InvalidRequestError('Invalid review state')
}

const reviewStates = new Set([REVIEWCLOSED, REVIEWESCALATED, REVIEWOPEN])

const reasonTypes = new Set([
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
  REASONAPPEAL,
])

const eventTypes = new Set([
  'tools.ozone.moderation.defs#modEventTakedown',
  'tools.ozone.moderation.defs#modEventAcknowledge',
  'tools.ozone.moderation.defs#modEventEscalate',
  'tools.ozone.moderation.defs#modEventComment',
  'tools.ozone.moderation.defs#modEventLabel',
  'tools.ozone.moderation.defs#modEventReport',
  'tools.ozone.moderation.defs#modEventMute',
  'tools.ozone.moderation.defs#modEventUnmute',
  'tools.ozone.moderation.defs#modEventMuteReporter',
  'tools.ozone.moderation.defs#modEventUnmuteReporter',
  'tools.ozone.moderation.defs#modEventReverseTakedown',
  'tools.ozone.moderation.defs#modEventEmail',
  'tools.ozone.moderation.defs#modEventResolveAppeal',
  'tools.ozone.moderation.defs#modEventTag',
  'tools.ozone.moderation.defs#modEventDivert',
])

export const getMemberRole = (role: string) => {
  if (memberRoles.has(role)) {
    return role as Member['role']
  }
  throw new InvalidRequestError('Invalid member role')
}

const memberRoles = new Set([ROLEADMIN, ROLEMODERATOR, ROLETRIAGE])
