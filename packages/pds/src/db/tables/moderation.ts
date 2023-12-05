import { Generated } from 'kysely'
import {
  REASONOTHER,
  REASONSPAM,
  REASONMISLEADING,
  REASONRUDE,
  REASONSEXUAL,
  REASONVIOLATION,
} from '../../lexicon/types/com/atproto/moderation/defs'

export const actionTableName = 'moderation_action'
export const actionSubjectBlobTableName = 'moderation_action_subject_blob'
export const reportTableName = 'moderation_report'
export const reportResolutionTableName = 'moderation_report_resolution'

export interface ModerationAction {
  id: Generated<number>
  action:
    | 'com.atproto.admin.defs#modEventTakedown'
    | 'com.atproto.admin.defs#modEventAcknowledge'
    | 'com.atproto.admin.defs#modEventEscalate'
    | 'com.atproto.admin.defs#modEventComment'
    | 'com.atproto.admin.defs#modEventLabel'
    | 'com.atproto.admin.defs#modEventReport'
    | 'com.atproto.admin.defs#modEventMute'
    | 'com.atproto.admin.defs#modEventReverseTakedown'
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
}

export interface ModerationActionSubjectBlob {
  actionId: number
  cid: string
  recordUri: string
}

export interface ModerationReport {
  id: Generated<number>
  subjectType: 'com.atproto.admin.defs#repoRef' | 'com.atproto.repo.strongRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  reasonType:
    | typeof REASONSPAM
    | typeof REASONOTHER
    | typeof REASONMISLEADING
    | typeof REASONRUDE
    | typeof REASONSEXUAL
    | typeof REASONVIOLATION
  reason: string | null
  reportedByDid: string
  createdAt: string
}

export interface ModerationReportResolution {
  reportId: number
  actionId: number
  createdAt: string
  createdBy: string
}

export type PartialDB = {
  [actionTableName]: ModerationAction
  [actionSubjectBlobTableName]: ModerationActionSubjectBlob
  [reportTableName]: ModerationReport
  [reportResolutionTableName]: ModerationReportResolution
}
