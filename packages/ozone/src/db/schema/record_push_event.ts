import { Generated } from 'kysely'

export const eventTableName = 'record_push_event'

export type RecordPushEventType = 'takedown'

export interface RecordPushEvent {
  eventType: RecordPushEventType
  subjectDid: string
  subjectUri: string
  subjectCid: string
  takedownId: number | null
  confirmedAt: Date | null
  lastAttempted: Date | null
  attempts: Generated<number>
}

export type PartialDB = {
  [eventTableName]: RecordPushEvent
}
