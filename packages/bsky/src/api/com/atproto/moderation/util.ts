import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { InputSchema as ReportInput } from '../../../../lexicon/types/com/atproto/moderation/createReport'
import { InputSchema as ActionInput } from '../../../../lexicon/types/com/atproto/admin/emitModerationEvent'
import {
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
  REASONAPPEAL,
} from '../../../../lexicon/types/com/atproto/moderation/defs'
import {
  REVIEWCLOSED,
  REVIEWESCALATED,
  REVIEWOPEN,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { ModerationEvent } from '../../../../db/tables/moderation'
import { ModerationSubjectStatusRow } from '../../../../services/moderation/types'

type SubjectInput = ReportInput['subject'] | ActionInput['subject']

export const getSubject = (subject: SubjectInput) => {
  if (
    subject.$type === 'com.atproto.admin.defs#repoRef' &&
    typeof subject.did === 'string'
  ) {
    return { did: subject.did }
  }
  if (
    subject.$type === 'com.atproto.repo.strongRef' &&
    typeof subject.uri === 'string' &&
    typeof subject.cid === 'string'
  ) {
    const uri = new AtUri(subject.uri)
    return {
      uri,
      cid: CID.parse(subject.cid),
    }
  }
  throw new InvalidRequestError('Invalid subject')
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
  'com.atproto.admin.defs#modEventTakedown',
  'com.atproto.admin.defs#modEventAcknowledge',
  'com.atproto.admin.defs#modEventEscalate',
  'com.atproto.admin.defs#modEventComment',
  'com.atproto.admin.defs#modEventLabel',
  'com.atproto.admin.defs#modEventReport',
  'com.atproto.admin.defs#modEventMute',
  'com.atproto.admin.defs#modEventUnmute',
  'com.atproto.admin.defs#modEventReverseTakedown',
  'com.atproto.admin.defs#modEventEmail',
])
