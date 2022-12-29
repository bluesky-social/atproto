import { Generated } from 'kysely'
import { TAKEDOWN } from '../../lexicon/types/app/bsky/admin/moderationAction'

export const moderationActionTableName = 'moderation_action'

export interface ModerationAction {
  id: Generated<number>
  action: typeof TAKEDOWN
  subjectType: 'app.bsky.admin.moderationAction#subjectActor'
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
