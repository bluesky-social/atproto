import { Generated } from 'kysely'

export const reportStatTableName = 'report_stat'

export interface ReportStat {
  id: Generated<number>
  queueId: number // -1 = aggregate across all queues
  /** The expiration policy for the statistic.
   * 'live' expires in 15 minutes
   * 'fixed' expires based on its timeframe (e.g. each day).
   * */
  mode: string // 'live' or 'fixed'
  timeframe: string // 'day' or 'week'
  inboundCount: number // Reports received in the last 24 hours
  pendingCount: number // Reports with status = 'open' (all time)
  actionedCount: number // Reports with status = 'closed' in last 24h
  escalatedCount: number // Reports with status = 'escalated' in last 24h
  actionRate: number // actionedCount / inboundCount * 100
  computedAt: string // ISO timestamp
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}
