import { Generated, GeneratedAlways, Insertable, Selectable } from 'kysely'

export type RepoSeqEventType =
  | 'append'
  | 'rebase'
  | 'handle'
  | 'migrate'
  | 'tombstone'

export const REPO_SEQ_SEQUENCE = 'repo_seq_sequence'

export interface RepoSeq {
  seq: GeneratedAlways<number>
  did: string
  eventType: RepoSeqEventType
  event: Uint8Array
  invalidated: Generated<0 | 1>
  sequencedAt: string
}

export type RepoSeqInsert = Insertable<RepoSeq>
export type RepoSeqEntry = Selectable<RepoSeq>

export const tableName = 'repo_seq'

export type PartialDB = {
  [tableName]: RepoSeq
}
