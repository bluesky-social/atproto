import {
  type AtIdentifierString,
  type DidString,
  isDidString,
} from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { AdminTokenOutput, ModeratorOutput } from '../auth-verifier.js'
import type { AppContext } from '../context.js'
import type { Member } from '../db/schema/member.js'
import type { ModerationEvent } from '../db/schema/moderation_event.js'
import { com, tools } from '../lexicons/index.js'
import type { ModerationSubjectStatusRow } from '../mod-service/types.js'

export const getAuthDid = (
  auth: ModeratorOutput | AdminTokenOutput,
  serviceDid: DidString,
): DidString | undefined => {
  return auth.credentials.type === 'moderator'
    ? auth.credentials.iss
    : auth.credentials.type === 'admin_token'
      ? serviceDid
      : undefined
}

export const getPdsAccountInfos = async (
  ctx: AppContext,
  identifiers: AtIdentifierString[],
): Promise<Map<string, com.atproto.admin.defs.AccountView | null>> => {
  const results = new Map<string, com.atproto.admin.defs.AccountView | null>()

  const client = ctx.pdsClient
  if (!client) return results

  // We only support dids, but input comes from at-uris, which allow handles.
  const uniqueDids = new Set(identifiers.filter(isDidString))
  if (!uniqueDids.size) return results

  const auth = await ctx.pdsAuth(com.atproto.admin.getAccountInfos.$lxm)
  if (!auth) return results

  try {
    const body = await client.call(
      com.atproto.admin.getAccountInfos,
      { dids: Array.from(uniqueDids) },
      auth,
    )
    body.infos.forEach((info) => {
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
  repoView:
    | tools.ozone.moderation.defs.RepoView
    | tools.ozone.moderation.defs.RepoViewDetail,
  accountInfo: com.atproto.admin.defs.AccountView | null,
  includeEmail = false,
): tools.ozone.moderation.defs.RepoViewDetail => {
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
  repoView: tools.ozone.moderation.defs.RepoView,
  accountInfo: com.atproto.admin.defs.AccountView | null,
  includeEmail = false,
): tools.ozone.moderation.defs.RepoView => {
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
  if ((eventTypes as Set<string>).has(type)) {
    return type as ModerationEvent['action']
  }
  throw new InvalidRequestError('Invalid event type')
}

export const getReviewState = (reviewState?: string) => {
  if (!reviewState) return undefined
  if (
    reviewStates.has(reviewState as ModerationSubjectStatusRow['reviewState'])
  ) {
    return reviewState as ModerationSubjectStatusRow['reviewState']
  }
  throw new InvalidRequestError('Invalid review state')
}

const reviewStates = new Set([
  tools.ozone.moderation.defs.reviewClosed.value,
  tools.ozone.moderation.defs.reviewEscalated.value,
  tools.ozone.moderation.defs.reviewOpen.value,
  tools.ozone.moderation.defs.reviewNone.value,
])

const eventTypes = new Set([
  tools.ozone.moderation.defs.modEventTakedown.$type,
  tools.ozone.moderation.defs.modEventAcknowledge.$type,
  tools.ozone.moderation.defs.modEventEscalate.$type,
  tools.ozone.moderation.defs.modEventComment.$type,
  tools.ozone.moderation.defs.modEventLabel.$type,
  tools.ozone.moderation.defs.modEventReport.$type,
  tools.ozone.moderation.defs.modEventMute.$type,
  tools.ozone.moderation.defs.modEventUnmute.$type,
  tools.ozone.moderation.defs.modEventMuteReporter.$type,
  tools.ozone.moderation.defs.modEventUnmuteReporter.$type,
  tools.ozone.moderation.defs.modEventReverseTakedown.$type,
  tools.ozone.moderation.defs.modEventEmail.$type,
  tools.ozone.moderation.defs.modEventResolveAppeal.$type,
  tools.ozone.moderation.defs.modEventTag.$type,
  tools.ozone.moderation.defs.modEventDivert.$type,
  tools.ozone.moderation.defs.accountEvent.$type,
  tools.ozone.moderation.defs.identityEvent.$type,
  tools.ozone.moderation.defs.recordEvent.$type,
  tools.ozone.moderation.defs.modEventPriorityScore.$type,
  tools.ozone.moderation.defs.ageAssuranceEvent.$type,
  tools.ozone.moderation.defs.ageAssuranceOverrideEvent.$type,
  tools.ozone.moderation.defs.ageAssurancePurgeEvent.$type,
  tools.ozone.moderation.defs.revokeAccountCredentialsEvent.$type,
  tools.ozone.moderation.defs.scheduleTakedownEvent.$type,
  tools.ozone.moderation.defs.cancelScheduledTakedownEvent.$type,
])

export const getMemberRole = (role: string) => {
  if (memberRoles.has(role as Member['role'])) {
    return role as Member['role']
  }
  throw new InvalidRequestError('Invalid member role')
}

const memberRoles = new Set([
  tools.ozone.team.defs.RoleAdmin,
  tools.ozone.team.defs.RoleModerator,
  tools.ozone.team.defs.RoleTriage,
  tools.ozone.team.defs.RoleVerifier,
])

export const OZONE_APPEAL_REASON_TYPE = tools.ozone.report.defs.ReasonAppeal
const APPEAL_REASON_TYPES = [
  com.atproto.moderation.defs.ReasonAppeal,
  OZONE_APPEAL_REASON_TYPE,
]
export const isAppealReport = (reasonType?: string): boolean => {
  return !!reasonType && (APPEAL_REASON_TYPES as string[]).includes(reasonType)
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
  'pending' | 'executed' | 'cancelled' | 'failed'

const scheduledActionTypes = new Set(['takedown'])
const scheduledActionStatuses = new Set([
  'pending',
  'executed',
  'cancelled',
  'failed',
])
