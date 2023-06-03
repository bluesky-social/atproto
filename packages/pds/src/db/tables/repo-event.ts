import { Generated, GeneratedAlways, Insertable, Selectable } from 'kysely'

export type EventType = 'append' | 'rebase' | 'handle' | 'migrate' | 'tombstone'

export interface RepoEvent {
  id: GeneratedAlways<number>
  did: string
  eventType: EventType
  event: Uint8Array
  invalidated: Generated<0 | 1>
  sequencedAt: string
}

export type RepoEventInsert = Insertable<RepoEvent>
export type RepoEventEntry = Selectable<RepoEvent>

export const tableName = 'repo_event'

export type PartialDB = {
  [tableName]: RepoEvent
}
