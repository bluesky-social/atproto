import { Generated } from 'kysely'
import {
  REVIEWCLOSED,
  REVIEWOPEN,
  REVIEWESCALATED,
  REVIEWNONE,
} from '../../lexicon/types/tools/ozone/moderation/defs'

export const subjectStatusTableName = 'moderation_subject_status'

export interface ModerationSubjectStatus {
  id: Generated<number>
  did: string
  recordPath: string
  recordCid: string | null
  blobCids: string[] | null
  reviewState:
    | typeof REVIEWCLOSED
    | typeof REVIEWOPEN
    | typeof REVIEWESCALATED
    | typeof REVIEWNONE
  createdAt: string
  updatedAt: string
  lastReviewedBy: string | null
  lastReviewedAt: string | null
  lastReportedAt: string | null
  lastAppealedAt: string | null
  hostingUpdatedAt: string | null
  hostingDeletedAt: string | null
  hostingCreatedAt: string | null
  hostingDeactivatedAt: string | null
  hostingReactivatedAt: string | null
  hostingStatus: string | null
  muteUntil: string | null
  muteReportingUntil: string | null
  suspendUntil: string | null
  takendown: boolean
  appealed: boolean | null
  comment: string | null
  tags: string[] | null
}

export type PartialDB = {
  [subjectStatusTableName]: ModerationSubjectStatus
}
