export const eventTableName = 'record_push_event'

export type RecordPushEventType = 'takedown'

export interface RecordPushEvent {
  eventType: RecordPushEventType
  subjectDid: string
  subjectUri: string
  subjectCid: string | null
  takedownId: number | null
  confirmedAt: string | null
}

export type PartialDB = {
  [eventTableName]: RecordPushEvent
}
