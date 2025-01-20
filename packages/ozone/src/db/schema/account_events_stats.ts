import { GeneratedAlways, Selectable } from 'kysely'

export const tableName = 'account_events_stats'

export type AccountEventsStats = {
  subjectDid: GeneratedAlways<string>
  takedownCount: GeneratedAlways<number>
  suspendCount: GeneratedAlways<number>
  escalateCount: GeneratedAlways<number>
  reportCount: GeneratedAlways<number>
  appealCount: GeneratedAlways<number>
}

export type AccountEventsStatsRow = Selectable<AccountEventsStats>

export type PartialDB = { [tableName]: AccountEventsStats }
