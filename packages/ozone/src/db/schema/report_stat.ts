import { Generated } from 'kysely'

export const reportStatTableName = 'report_stat'

export interface ReportStat {
  // metadata
  id: Generated<number>
  computedAt: string

  // group
  /** The expiration policy for the statistic.
   * 'live' expires in 15 minutes
   * 'historical' expires based on its timeframe (e.g. each day).
   * */
  mode: string
  timeframe: string // 'day' or 'week'
  queueId: number | null // NULL = aggregate across all queues
  reportTypes: string[] | null // NULL = aggregate across all report types
  moderatorDid: string | null // NULL = aggregate, non-null = per-moderator

  // stats
  inboundCount: number | null // Reports received in the last 24 hours
  pendingCount: number | null // Reports with status = 'open' (all time)
  actionedCount: number | null // Reports with status = 'closed' in last 24h
  escalatedCount: number | null // Reports with status = 'escalated' in last 24h
  actionRate: number | null // actionedCount / inboundCount * 100
  avgHandlingTimeSec: number | null // Average time from open/assigned to closed, in milliseconds
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}
