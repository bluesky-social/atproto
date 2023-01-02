import { Generated } from 'kysely'
import {
  ACKNOWLEDGE,
  FLAG,
  TAKEDOWN,
} from '../../lexicon/types/com/atproto/admin/moderationAction'
import { OTHER, SPAM } from '../../lexicon/types/com/atproto/repo/report'

export const actionTableName = 'moderation_action'
export const reportTableName = 'moderation_report'
export const reportResolutionTableName = 'moderation_report_resolution'

export interface ModerationAction {
  id: Generated<number>
  action: typeof TAKEDOWN | typeof FLAG | typeof ACKNOWLEDGE
  subjectType:
    | 'com.atproto.admin.moderationAction#subjectRepo'
    | 'com.atproto.admin.moderationAction#subjectRecord'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  reason: string
  createdAt: string
  createdBy: string
  reversedAt: string | null
  reversedBy: string | null
  reversedReason: string | null
}

export interface ModerationReport {
  id: Generated<number>
  subjectType:
    | 'com.atproto.repo.report#subjectRepo'
    | 'com.atproto.repo.report#subjectRecord'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  reasonType: typeof SPAM | typeof OTHER
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
  [reportTableName]: ModerationReport
  [reportResolutionTableName]: ModerationReportResolution
}
