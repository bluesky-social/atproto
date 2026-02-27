import { Generated } from 'kysely'

export const moderatorAssignmentTableName = 'moderator_assignment'

export interface ModeratorAssignment {
  id: Generated<number>
  did: string
  reportId: number | null
  queueId: number | null
  startAt: string
  endAt: string
}

export type PartialDB = {
  [moderatorAssignmentTableName]: ModeratorAssignment
}
