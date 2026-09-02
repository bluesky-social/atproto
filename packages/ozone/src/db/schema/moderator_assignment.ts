import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'

export const moderatorAssignmentTableName = 'moderator_assignment'

export interface ModeratorAssignment {
  id: Generated<number>
  did: DidString
  reportId: number | null
  queueId: number | null
  startAt: DatetimeString
  endAt: DatetimeString | null
}

export type PartialDB = {
  [moderatorAssignmentTableName]: ModeratorAssignment
}
