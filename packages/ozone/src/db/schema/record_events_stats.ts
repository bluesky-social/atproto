import { GeneratedAlways, Selectable } from 'kysely'

export const tableName = 'record_events_stats'

export type RecordEventsStats = {
  subjectDid: GeneratedAlways<string>
  subjectUri: GeneratedAlways<string>
  escalateCount: GeneratedAlways<number>
  reportCount: GeneratedAlways<number>
  appealCount: GeneratedAlways<number>
}

export type RecordEventsStatsRow = Selectable<RecordEventsStats>

export type PartialDB = { [tableName]: RecordEventsStats }
