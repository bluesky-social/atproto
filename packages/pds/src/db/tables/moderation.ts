import { Generated } from 'kysely'
import { TAKEDOWN } from '../../lexicon/types/com/atproto/admin/moderationAction'

export const moderationActionTableName = 'moderation_action'

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

export type PartialDB = {
  [moderationActionTableName]: ModerationAction
}
