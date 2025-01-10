import { GeneratedAlways, Selectable } from 'kysely'

export const tableName = 'account_record_status_stats'

type AccountRecordStatusStats = {
  did: GeneratedAlways<string>
  subjectCount: GeneratedAlways<number>
  pendingCount: GeneratedAlways<number>
  processedCount: GeneratedAlways<number>
  takendownCount: GeneratedAlways<number>
}

export type AccountRecordStatusStatsRow = Selectable<AccountRecordStatusStats>

export type PartialDB = { [tableName]: AccountRecordStatusStats }
