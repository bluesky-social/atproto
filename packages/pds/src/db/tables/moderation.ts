import { Generated } from 'kysely'
import { TAKEDOWN } from '../../lexicon/types/com/atproto/admin/moderationAction'

export const actionTableName = 'moderation_action'
export const reportTableName = 'moderation_report'

export interface ModerationAction {
  id: Generated<number>
  action: typeof TAKEDOWN
  subjectType: 'com.atproto.admin.moderationAction#subjectRepo'
  subjectDid: string | null
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
  reasonType: 'com.atproto.repo.report#spam' | 'com.atproto.repo.report#other'
  reason: string | null
  reportedByDid: string
  createdAt: string
  resolvedByAction: number | null
}

export type PartialDB = {
  [actionTableName]: ModerationAction
  [reportTableName]: ModerationReport
}
