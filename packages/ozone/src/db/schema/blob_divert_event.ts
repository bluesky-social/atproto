import { Generated } from 'kysely'

export const eventTableName = 'blob_divert_event'

export interface BlobDivertEvent {
  id: Generated<number>
  subjectDid: string
  subjectBlobCid: string
  subjectUri: string
  divertedAt: Date | null
  lastAttempted: Date | null
  attempts: Generated<number>
}

export type PartialDB = {
  [eventTableName]: BlobDivertEvent
}
