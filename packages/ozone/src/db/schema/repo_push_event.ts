import { Generated } from 'kysely'

export const eventTableName = 'repo_push_event'

export type RepoPushEventType = 'takedown'

export interface RepoPushEvent {
  eventType: RepoPushEventType
  subjectDid: string
  takedownId: number | null
  confirmedAt: Date | null
  lastAttempted: Date | null
  attempts: Generated<number>
}

export type PartialDB = {
  [eventTableName]: RepoPushEvent
}
