import { InvalidRequestError } from '@atproto/xrpc-server'
import { InputSchema as ReportInput } from '../../lexicon/types/com/atproto/moderation/createReport'
import {
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
  REASONAPPEAL,
} from '../../lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../../lexicon/types/tools/ozone/defs'
import { ModerationEvent } from '../../db/schema/moderation_event'
import { ModerationSubjectStatusRow } from '../../mod-service/types'

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
  'tools.ozone.defs#modEventTakedown',
  'tools.ozone.defs#modEventAcknowledge',
  'tools.ozone.defs#modEventEscalate',
  'tools.ozone.defs#modEventComment',
  'tools.ozone.defs#modEventLabel',
  'tools.ozone.defs#modEventReport',
  'tools.ozone.defs#modEventMute',
  'tools.ozone.defs#modEventUnmute',
  'tools.ozone.defs#modEventReverseTakedown',
  'tools.ozone.defs#modEventEmail',
  'tools.ozone.defs#modEventResolveAppeal',
  'tools.ozone.defs#modEventTag',
])
