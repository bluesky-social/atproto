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
    deactivatedAt: accountInfo.deactivatedAt,
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
