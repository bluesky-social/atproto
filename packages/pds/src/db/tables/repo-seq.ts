import { Generated, GeneratedAlways, Insertable, Selectable } from 'kysely'

export type EventType = 'append' | 'rebase' | 'handle' | 'migrate' | 'tombstone'

export interface RepoSeq {
  seq: GeneratedAlways<number>
  did: string
  eventType: EventType
  event: Uint8Array
  invalidated: Generated<0 | 1>
  sequencedAt: string
}

export type RepoSeqInsert = Insertable<RepoSeq>
export type RepoSeqEntry = Selectable<RepoSeq>

export const tableName = 'repo_seq'

export type PartialDB = { [tableName]: RepoSeq }
