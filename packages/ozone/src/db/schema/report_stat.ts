import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/lex'

/**
 * A calendar day in `YYYY-MM-DD` form. Typed as a template literal so it
 * composes into a {@link DatetimeString} without a cast.
 */
export type DateString = `${string}-${string}-${string}`

export const reportStatTableName = 'report_stat'

export interface ReportStat {
  // metadata
  id: Generated<number>
  computedAt: DatetimeString // When this snapshot was last computed

  // group
  date: DateString // ISO date e.g. '2026-04-15' — the calendar day this snapshot covers
  queueId: number | null // NULL = aggregate across all queues
  reportTypes: string[] | null // NULL = aggregate across all report types
  moderatorDid: DidString | null // NULL = aggregate, non-null = per-moderator

  // inbound
  inboundCount: number | null // Reports received during this calendar day

  // unresolved
  pendingCount: number | null // Reports with status != 'closed' at time of computation
  escalatedCount: number | null // Reports escalated during this calendar day

  // resolved
  actionedCount: number | null // Current closures whose last action was enforcement
  actionRate: number | null // actionedCount / closedCount * 100
  labelActionCount: number | null // Current closures whose last action was label
  tagActionCount: number | null // Current closures whose last action was tag
  takedownActionCount: number | null // Current closures whose last action was takedown
  acknowledgedCount: number | null // Current closures without a last enforcement action
  closedCount: number | null // Current reports with closedAt in this calendar day

  // handling time
  avgHandlingTimeSec: number | null // Average time from assignment to close, in seconds
  ahtDurationSec: number | null // Sum of assignment-to-close durations
  ahtSampleCount: number | null // Assigned closed-report samples in ahtDurationSec

  // resolution time
  resolutionDurationSec: number | null // Sum of creation-to-close durations
  resolutionSampleCount: number | null // Closed-report samples in resolutionDurationSec
  avgResolutionTimeSec: number | null // Average time from creation to close, in seconds
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}
