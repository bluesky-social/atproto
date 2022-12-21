import { Generated } from 'kysely'

export const moderationActionTableName = 'moderation_action'

export interface ModerationAction {
  id: Generated<number>
  action: 'takedown'
  subjectType: 'actor'
  subjectDid: string | null
  subjectDeclarationCid: string | null
  rationale: string
  createdAt: string
  createdBy: string
  reversedAt: string | null
  reversedBy: string | null
  reversedRationale: string | null
}

export type PartialDB = {
  [moderationActionTableName]: ModerationAction
}
