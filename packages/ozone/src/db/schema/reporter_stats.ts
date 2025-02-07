import { GeneratedAlways, Selectable } from 'kysely'

export const tableName = 'reporter_stats'

export type ReporterStats = {
  did: GeneratedAlways<string>
  accountReportCount: GeneratedAlways<number>
  recordReportCount: GeneratedAlways<number>
  reportedAccountCount: GeneratedAlways<number>
  reportedRecordCount: GeneratedAlways<number>
  takendownAccountCount: GeneratedAlways<number>
  takendownRecordCount: GeneratedAlways<number>
  labeledAccountCount: GeneratedAlways<number>
  labeledRecordCount: GeneratedAlways<number>
}

export type ReporterStatsRow = Selectable<ReporterStats>

export type PartialDB = { [tableName]: ReporterStats }
