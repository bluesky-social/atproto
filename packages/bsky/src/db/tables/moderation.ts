import { Generated } from 'kysely'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
  ESCALATE,
} from '../../lexicon/types/com/atproto/admin/defs'
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
  action: typeof TAKEDOWN | typeof FLAG | typeof ACKNOWLEDGE | typeof ESCALATE
  subjectType: 'com.atproto.admin.defs#repoRef' | 'com.atproto.repo.strongRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  createLabelVals: string | null
  negateLabelVals: string | null
  reason: string
  createdAt: string
  createdBy: string
  reversedAt: string | null
  reversedBy: string | null
  reversedReason: string | null
  durationInHours: number | null
  expiresAt: string | null
}

export interface ModerationActionSubjectBlob {
  actionId: number
  cid: string
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
