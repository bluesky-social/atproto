import { Generated } from 'kysely'
import {
  REVIEWCLOSED,
  REVIEWOPEN,
  REVIEWESCALATED,
} from '../../../../lexicon/types/com/atproto/admin/defs'

export const eventTableName = 'moderation_event'
export const subjectStatusTableName = 'moderation_subject_status'

export interface ModerationEvent {
  id: Generated<number>
  action:
    | 'tools.ozone.defs#modEventTakedown'
    | 'tools.ozone.defs#modEventAcknowledge'
    | 'tools.ozone.defs#modEventEscalate'
    | 'tools.ozone.defs#modEventComment'
    | 'tools.ozone.defs#modEventLabel'
    | 'tools.ozone.defs#modEventReport'
    | 'tools.ozone.defs#modEventMute'
    | 'tools.ozone.defs#modEventReverseTakedown'
    | 'tools.ozone.defs#modEventEmail'
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
  meta: Record<string, string | boolean> | null
  legacyRefId: number | null
}

export interface ModerationSubjectStatus {
  id: Generated<number>
  did: string
  recordPath: string
  recordCid: string | null
  blobCids: string[] | null
  reviewState: typeof REVIEWCLOSED | typeof REVIEWOPEN | typeof REVIEWESCALATED
  createdAt: string
  updatedAt: string
  lastReviewedBy: string | null
  lastReviewedAt: string | null
  lastReportedAt: string | null
  muteUntil: string | null
  suspendUntil: string | null
  takendown: boolean
  comment: string | null
}

export type PartialDB = {
  [eventTableName]: ModerationEvent
  [subjectStatusTableName]: ModerationSubjectStatus
}
