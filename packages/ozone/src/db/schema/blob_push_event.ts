import { Generated } from 'kysely'

export const eventTableName = 'blob_push_event'

export type BlobPushEventType = 'pds_takedown' | 'appview_takedown'

export interface BlobPushEvent {
  eventType: BlobPushEventType
  subjectDid: string
  subjectBlobCid: string
  subjectUri: string | null
  takedownRef: string | null
  confirmedAt: Date | null
  lastAttempted: Date | null
  attempts: Generated<number>
}

export type PartialDB = {
  [eventTableName]: BlobPushEvent
}
