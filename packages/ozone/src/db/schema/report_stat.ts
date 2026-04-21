import { Generated } from 'kysely'

export const reportStatTableName = 'report_stat'

export interface ReportStat {
  // metadata
  id: Generated<number>
  computedAt: string // When this snapshot was last computed

  // group
  date: string // ISO date e.g. '2026-04-15' — the calendar day this snapshot covers
  queueId: number | null // NULL = aggregate across all queues
  reportTypes: string[] | null // NULL = aggregate across all report types
  moderatorDid: string | null // NULL = aggregate, non-null = per-moderator

  // stats
  inboundCount: number | null // Reports received during this calendar day
  pendingCount: number | null // Reports with status != 'closed' at time of computation
  actionedCount: number | null // Reports closed during this calendar day
  escalatedCount: number | null // Reports escalated during this calendar day
  actionRate: number | null // actionedCount / inboundCount * 100
  avgHandlingTimeSec: number | null // Average time from creation/assignment to close, in seconds
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}
