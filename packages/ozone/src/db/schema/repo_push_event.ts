export const eventTableName = 'repo_push_event'

export type RepoPushEventType = 'takedown'

export interface RepoPushEvent {
  eventType: RepoPushEventType
  subjectDid: string
  takedownId: number | null
  confirmedAt: string | null
}

export type PartialDB = {
  [eventTableName]: RepoPushEvent
}
