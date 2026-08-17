import type { Generated } from 'kysely'

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
  actionedCount: number | null // Current closures whose last action was enforcement
  escalatedCount: number | null // Reports escalated during this calendar day
  actionRate: number | null // actionedCount / inboundCount * 100
  avgHandlingTimeSec: number | null // Average time from assignment to close, in seconds
  closedCount: number | null // Current reports with closedAt in this calendar day
  acknowledgedCount: number | null // Current closures without a last enforcement action
  labelActionCount: number | null // Current closures whose last action was label
  tagActionCount: number | null // Current closures whose last action was tag
  takedownActionCount: number | null // Current closures whose last action was takedown
  ahtDurationSec: number | null // Sum of assignment-to-close durations
  ahtSampleCount: number | null // Assigned closed-report samples in ahtDurationSec
  resolutionDurationSec: number | null // Sum of creation-to-close durations
  resolutionSampleCount: number | null // Closed-report samples in resolutionDurationSec
  avgResolutionTimeSec: number | null // Average time from creation to close, in seconds
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}
