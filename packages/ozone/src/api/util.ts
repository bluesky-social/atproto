import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../context'
import { Member } from '../db/schema/member'
import { ModerationEvent } from '../db/schema/moderation_event'
import { ids } from '../lexicon/lexicons'
import { AccountView } from '../lexicon/types/com/atproto/admin/defs'
import { REASONAPPEAL } from '../lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWNONE,
  REVIEWOPEN,
  RepoView,
  RepoViewDetail,
} from '../lexicon/types/tools/ozone/moderation/defs'
import {
  ROLEADMIN,
  ROLEMODERATOR,
  ROLETRIAGE,
  ROLEVERIFIER,
} from '../lexicon/types/tools/ozone/team/defs'
import { ModerationSubjectStatusRow } from '../mod-service/types'

export const getPdsAccountInfos = async (
  ctx: AppContext,
  dids: string[],
): Promise<Map<string, AccountView | null>> => {
  const results = new Map<string, AccountView | null>()

  const agent = ctx.pdsAgent
  if (!agent || !dids.length) return results

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

function un$type<T extends object>(obj: T): Omit<T, '$type'> {
  if ('$type' in obj) {
    const { $type: _, ...rest } = obj
    return rest
  }
  return obj
}

export const addAccountInfoToRepoViewDetail = (
  repoView: RepoView | RepoViewDetail,
  accountInfo: AccountView | null,
  includeEmail = false,
): RepoViewDetail => {
  if (!accountInfo) {
    return un$type({
      ...repoView,
      moderation: un$type(repoView.moderation),
    })
  }

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
    $type: _accountType,
    did: _did,
    handle: _handle,
    indexedAt: _indexedAt,
    relatedRecords: _relatedRecords,
    ...otherAccountInfo
  } = accountInfo
  return {
    ...otherAccountInfo,
    ...un$type(repoView),
    moderation: un$type(repoView.moderation),
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

const reviewStates = new Set([
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
  REVIEWNONE,
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
  'tools.ozone.moderation.defs#accountEvent',
  'tools.ozone.moderation.defs#identityEvent',
  'tools.ozone.moderation.defs#recordEvent',
  'tools.ozone.moderation.defs#modEventPriorityScore',
  'tools.ozone.moderation.defs#ageAssuranceEvent',
  'tools.ozone.moderation.defs#ageAssuranceOverrideEvent',
  'tools.ozone.moderation.defs#revokeAccountCredentialsEvent',
  'tools.ozone.moderation.defs#scheduleTakedownEvent',
  'tools.ozone.moderation.defs#cancelScheduledTakedownEvent',
])

export const getMemberRole = (role: string) => {
  if (memberRoles.has(role)) {
    return role as Member['role']
  }
  throw new InvalidRequestError('Invalid member role')
}

const memberRoles = new Set([
  ROLEADMIN,
  ROLEMODERATOR,
  ROLETRIAGE,
  ROLEVERIFIER,
])

export const OZONE_APPEAL_REASON_TYPE = 'tools.ozone.report.defs#reasonAppeal'
const APPEAL_REASON_TYPES = [REASONAPPEAL, OZONE_APPEAL_REASON_TYPE]
export const isAppealReport = (reasonType?: string): boolean => {
  return !!reasonType && APPEAL_REASON_TYPES.includes(reasonType)
}

export const getSafelinkPattern = (pattern: string): SafelinkPatternType => {
  if (safelinkPatterns.has(pattern)) {
    return pattern as SafelinkPatternType
  }
  throw new InvalidRequestError('Invalid safelink pattern type')
}

export const getSafelinkAction = (action: string): SafelinkActionType => {
  if (safelinkActions.has(action)) {
    return action as SafelinkActionType
  }
  throw new InvalidRequestError('Invalid safelink action type')
}

export const getSafelinkReason = (reason: string): SafelinkReasonType => {
  if (safelinkReasons.has(reason)) {
    return reason as SafelinkReasonType
  }
  throw new InvalidRequestError('Invalid safelink reason type')
}

export const getSafelinkEventType = (eventType: string): SafelinkEventType => {
  if (safelinkEventTypes.has(eventType)) {
    return eventType as SafelinkEventType
  }
  throw new InvalidRequestError('Invalid safelink event type')
}

export type SafelinkEventType = 'addRule' | 'updateRule' | 'removeRule'
export type SafelinkPatternType = 'domain' | 'url'
export type SafelinkActionType = 'block' | 'warn' | 'whitelist'
export type SafelinkReasonType = 'csam' | 'spam' | 'phishing' | 'none'

const safelinkPatterns = new Set(['domain', 'url'])
const safelinkActions = new Set(['block', 'warn', 'whitelist'])
const safelinkReasons = new Set(['csam', 'spam', 'phishing', 'none'])
const safelinkEventTypes = new Set(['addRule', 'updateRule', 'removeRule'])

export const getScheduledActionType = (action: string): ScheduledActionType => {
  if (scheduledActionTypes.has(action)) {
    return action as ScheduledActionType
  }
  throw new InvalidRequestError('Invalid scheduled action type')
}

export const getScheduledActionStatus = (
  status: string,
): ScheduledActionStatus => {
  if (scheduledActionStatuses.has(status)) {
    return status as ScheduledActionStatus
  }
  throw new InvalidRequestError('Invalid scheduled action status')
}

export type ScheduledActionType = 'takedown'
export type ScheduledActionStatus =
  | 'pending'
  | 'executed'
  | 'cancelled'
  | 'failed'

const scheduledActionTypes = new Set(['takedown'])
const scheduledActionStatuses = new Set([
  'pending',
  'executed',
  'cancelled',
  'failed',
])
