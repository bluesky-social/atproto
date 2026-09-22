import type { Generated } from 'kysely'
import type { AtUriString, DidString } from '@atproto/lex'

export const eventTableName = 'record_push_event'

export type RecordPushEventType = 'pds_takedown' | 'appview_takedown'

export interface RecordPushEvent {
  id: Generated<number>
  eventType: RecordPushEventType
  subjectDid: DidString
  subjectUri: AtUriString
  subjectCid: string
  takedownRef: string | null
  confirmedAt: Date | null
  lastAttempted: Date | null
  attempts: Generated<number>
}

export type PartialDB = {
  [eventTableName]: RecordPushEvent
}
