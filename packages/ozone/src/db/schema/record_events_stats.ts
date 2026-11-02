import type { GeneratedAlways, Selectable } from 'kysely'

// View over record_events_stats_live, which the record_events_stats_track()
// triggers and the daemon's RecordEventsStatsWorker maintain. Read-only: never
// write to it directly.
export const tableName = 'record_events_stats'

export type RecordEventsStats = {
  subjectDid: GeneratedAlways<string>
  // at-uri for record subjects, convoId for convo/message subjects
  subjectKey: GeneratedAlways<string>
  escalateCount: GeneratedAlways<number>
  reportCount: GeneratedAlways<number>
  appealCount: GeneratedAlways<number>
}

export type RecordEventsStatsRow = Selectable<RecordEventsStats>

export type PartialDB = { [tableName]: RecordEventsStats }
