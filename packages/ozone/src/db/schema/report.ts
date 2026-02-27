import { Generated } from 'kysely'

export const reportTableName = 'report'

export interface Report {
  id: Generated<number>
  eventId: number // References moderation_event.id
  queueId: number | null // NULL = not yet assigned, -1 = no matching queue
  queuedAt: string | null
  actionEventIds: number[] | null // Array of event IDs, sorted DESC [newest, ..., oldest]
  actionNote: string | null
  status: string // 'open', 'closed', 'escalated'
  createdAt: string
  updatedAt: string
}

export type PartialDB = {
  [reportTableName]: Report
}
