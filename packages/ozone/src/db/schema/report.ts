import { Generated } from 'kysely'

export const reportTableName = 'report'

export interface Report {
  id: Generated<number>
  eventId: number // References moderation_event.id
  queueId: number | null // NULL = not yet assigned, -1 = no matching queue
  queuedAt: string | null
  actionEventIds: number[] | null // Array of event IDs, sorted DESC [newest, ..., oldest]
  actionNote: string | null
  isMuted: boolean
  status: string // 'open', 'closed', 'escalated', 'queued', 'assigned'
  reportType: string // Denormalized from moderation_event.meta.reportType
  did: string // Denormalized from moderation_event.subjectDid
  recordPath: string // '' = account/message, 'collection/rkey' = record
  subjectMessageId: string | null // Denormalized from moderation_event.subjectMessageId
  createdAt: string
  updatedAt: string
  assignedTo: string | null // DID of permanently assigned moderator, null if unassigned
}

export type PartialDB = {
  [reportTableName]: Report
}
