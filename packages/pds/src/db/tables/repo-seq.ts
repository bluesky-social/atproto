import { Generated, Selectable } from 'kysely'

export interface RepoSeq {
  seq: Generated<number>
  did: string
  eventType: 'append' | 'rebase' | 'handle' | 'migrate' | 'tombstone'
  event: Uint8Array
  invalidatedBy: number | null
  sequencedAt: string
}

export type RepoSeqEntry = Selectable<RepoSeq>

export const tableName = 'repo_seq'

export type PartialDB = { [tableName]: RepoSeq }
