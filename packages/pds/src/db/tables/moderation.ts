import { Generated } from 'kysely'
import { TAKEDOWN } from '../../lexicon/types/com/atproto/admin/moderationAction'

export const actionTableName = 'moderation_action'
export const reportTableName = 'moderation_report'
export const reportResolutionTableName = 'moderation_report_resolution'

export interface ModerationAction {
  id: Generated<number>
  action: typeof TAKEDOWN
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
    | 'com.atproto.report.subject#repo'
    | 'com.atproto.report.subject#record'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  reasonType:
    | 'com.atproto.report.reason#spam'
    | 'com.atproto.report.reason#other'
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
