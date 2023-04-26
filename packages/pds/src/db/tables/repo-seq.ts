import { GeneratedAlways, Insertable, Selectable } from 'kysely'

export interface RepoSeq {
  seq: GeneratedAlways<number>
  did: string
  eventType: 'append' | 'rebase' | 'handle' | 'migrate' | 'tombstone'
  event: Uint8Array
  invalidatedBy: number | null
  sequencedAt: string
}

export type RepoSeqInsert = Insertable<RepoSeq>
export type RepoSeqEntry = Selectable<RepoSeq>

export const tableName = 'repo_seq'

export type PartialDB = { [tableName]: RepoSeq }
