import { Generated } from 'kysely'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
  ESCALATE,
  ActionMeta,
  MUTE,
  REPORT,
  LABEL,
  REVERT,
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
  reversedAt: string | null
  reversedBy: string | null
  reversedReason: string | null
  durationInHours: number | null
  expiresAt: string | null
  refEventId: number | null
  // TODO: better types here?
  meta: ActionMeta | null
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
