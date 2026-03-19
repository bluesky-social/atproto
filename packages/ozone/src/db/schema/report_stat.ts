import { Generated } from 'kysely'

export const reportStatTableName = 'report_stat'

export interface ReportStat {
  id: Generated<number>
  queueId: number | null // NULL = aggregate across all queues
  mode: string // 'live' or 'fixed'
  timeframe: string // 'day' or 'week'
  inboundCount: number // Reports received in the last 24 hours
  pendingCount: number // Reports with status = 'open' (all time)
  actionedCount: number // Reports with status = 'closed' in last 24h
  escalatedCount: number // Reports with status = 'escalated' in last 24h
  actionRate: number | null // actionedCount / inboundCount * 100, NULL when inboundCount = 0
  computedAt: string // ISO timestamp
}

export type PartialDB = {
  [reportStatTableName]: ReportStat
}


export type ReportStatMode = 'live' | 'fixed'
export type ReportStatTimeframe = 'day' | 'week'
