export const eventTableName = 'repo_push_event'

export type RepoPushEventType = 'takedown'

export interface RepoPushEvent {
  eventType: RepoPushEventType
  subjectDid: string
  takedownId: number | null
  confirmedAt: Date | null
  lastAttempted: Date | null
  attempts: number | null
}

export type PartialDB = {
  [eventTableName]: RepoPushEvent
}
