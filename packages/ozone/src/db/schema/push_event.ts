export const eventTableName = 'push_event'

export type PushEventType =
  | 'repo_takedown'
  | 'record_takedown'
  | 'blob_takedown'

export interface PushEvent {
  eventType: PushEventType
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  subjectBlobCid: string | null
  takedownId: number | null
  confirmedAt: string | null
}

export type PartialDB = {
  [eventTableName]: PushEvent
}
