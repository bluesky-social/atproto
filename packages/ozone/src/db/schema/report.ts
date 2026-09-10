import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'

export const reportTableName = 'report'

export interface Report {
  id: Generated<number>
  eventId: number // References moderation_event.id
  queueId: number | null // NULL = not yet assigned, -1 = no matching queue
  queuedAt: DatetimeString | null
  actionEventIds: number[] | null // Array of event IDs, sorted DESC [newest, ..., oldest]
  actionNote: string | null
  isMuted: boolean
  isAutomated: boolean // Denormalized from moderation_event.modTool.meta.isAutomated
  status: string // 'open', 'closed', 'escalated', 'queued', 'assigned'
  reportType: string // Denormalized from moderation_event.meta.reportType
  did: DidString // Denormalized from moderation_event.subjectDid
  recordPath: string // '' = account/message/conversation, 'collection/rkey' = record
  subjectMessageId: string | null // Denormalized from moderation_event.subjectMessageId
  subjectConvoId: string | null // Denormalized from moderation_event.subjectConvoId
  createdAt: DatetimeString
  updatedAt: DatetimeString
  assignedTo: DidString | null // DID of permanently assigned moderator, null if unassigned
  assignedAt: DatetimeString | null // When the permanent assignment was created
  closedAt: DatetimeString | null
}

export type PartialDB = {
  [reportTableName]: Report
}
