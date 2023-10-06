import { Generated } from 'kysely'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
  ESCALATE,
  LABEL,
  REVERT,
  MUTE,
  REPORT,
  ActionMeta,
  REVIEWCLOSED,
  REVIEWOPEN,
  REVIEWESCALATED,
} from '../../lexicon/types/com/atproto/admin/defs'

export const eventTableName = 'moderation_event'
export const actionSubjectBlobTableName = 'moderation_action_subject_blob'
export const subjectStatusTableName = 'moderation_subject_status'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | typeof TAKEDOWN
    | typeof FLAG
    | typeof ACKNOWLEDGE
    | typeof ESCALATE
    | typeof MUTE
    | typeof REPORT
    | typeof LABEL
    | typeof REVERT
  subjectType: 'com.atproto.admin.defs#repoRef' | 'com.atproto.repo.strongRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  createLabelVals: string | null
  negateLabelVals: string | null
  comment: string | null
  createdAt: string
  createdBy: string
  durationInHours: number | null
  expiresAt: string | null
  refEventId: number | null
  // TODO: better types here?
  meta: ActionMeta | null
}

export interface ModerationEventSubjectBlob {
  actionId: number
  cid: string
}

export interface ModerationSubjectStatus {
  id: Generated<number>
  did: string
  recordCid: string | null
  recordPath: string | null
  reviewState: typeof REVIEWCLOSED | typeof REVIEWOPEN | typeof REVIEWESCALATED
  createdAt: string
  updatedAt: string
  lastReviewedAt: string | null
  lastReportedAt: string | null
  muteUntil: string | null
  suspendUntil: string | null
  takendown: boolean
  note: string | null
}

export type PartialDB = {
  [eventTableName]: ModerationEvent
  [actionSubjectBlobTableName]: ModerationEventSubjectBlob
  [subjectStatusTableName]: ModerationSubjectStatus
}
