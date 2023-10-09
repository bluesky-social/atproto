import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/syntax'
import { InputSchema as ReportInput } from '../../../../lexicon/types/com/atproto/moderation/createReport'
import { InputSchema as ActionInput } from '../../../../lexicon/types/com/atproto/admin/emitModerationEvent'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
  ESCALATE,
  REVERT,
  COMMENT,
  MUTE,
  LABEL,
  REPORT,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import {
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
} from '../../../../lexicon/types/com/atproto/moderation/defs'
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

export const getReviewState = (reviewState?: string) => {
  return reviewState as ModerationSubjectStatusRow['reviewState']
}

export const getAction = (action: ActionInput['action']) => {
  if (
    action === TAKEDOWN ||
    action === FLAG ||
    action === ACKNOWLEDGE ||
    action === REVERT ||
    action === LABEL ||
    action === MUTE ||
    action === COMMENT ||
    action === REPORT ||
    action === ESCALATE
  ) {
    return action as ModerationEvent['action']
  }
  throw new InvalidRequestError('Invalid action')
}

const reasonTypes = new Set([
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
])
