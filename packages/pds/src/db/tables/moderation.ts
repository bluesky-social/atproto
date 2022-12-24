import { Generated } from 'kysely'

export const moderationActionTableName = 'moderation_action'

export interface ModerationAction {
  id: Generated<number>
  action: 'app.bsky.admin.actionTakedown'
  subjectType: 'actor'
  subjectDid: string | null
  subjectDeclarationCid: string | null
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
