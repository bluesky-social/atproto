import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'
import type { tools } from '../../lexicons/index.js'

export const subjectStatusTableName = 'moderation_subject_status'

export interface ModerationSubjectStatus {
  id: Generated<number>

  // unique columns
  did: DidString
  recordPath: string
  convoId: string

  recordCid: string | null
  blobCids: string[] | null
  reviewState:
    | tools.ozone.moderation.defs.ReviewClosed
    | tools.ozone.moderation.defs.ReviewOpen
    | tools.ozone.moderation.defs.ReviewEscalated
    | tools.ozone.moderation.defs.ReviewNone
  createdAt: DatetimeString
  updatedAt: DatetimeString
  lastReviewedBy: DidString | null
  lastReviewedAt: DatetimeString | null
  lastReportedAt: DatetimeString | null
  lastAppealedAt: DatetimeString | null
  hostingUpdatedAt: DatetimeString | null
  hostingDeletedAt: DatetimeString | null
  hostingCreatedAt: DatetimeString | null
  hostingDeactivatedAt: DatetimeString | null
  hostingReactivatedAt: DatetimeString | null
  hostingStatus: string | null
  muteUntil: DatetimeString | null
  muteReportingUntil: DatetimeString | null
  suspendUntil: DatetimeString | null
  takendown: boolean
  appealed: boolean | null
  comment: string | null
  tags: string[] | null
  priorityScore?: number
  ageAssuranceState: string
  ageAssuranceUpdatedBy?: string | null
}

export type PartialDB = {
  [subjectStatusTableName]: ModerationSubjectStatus
}
