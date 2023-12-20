export const eventTableName = 'blob_push_event'

export type BlobPushEventType = 'takedown'

export interface BlobPushEvent {
  eventType: BlobPushEventType
  subjectDid: string
  subjectBlobCid: string
  subjectUri: string | null
  takedownId: number | null
  confirmedAt: string | null
}

export type PartialDB = {
  [eventTableName]: BlobPushEvent
}
