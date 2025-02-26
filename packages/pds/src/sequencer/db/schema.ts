import { Generated, GeneratedAlways, Insertable, Selectable } from 'kysely'

export type RepoSeqEventType = 'append' | 'sync' | 'identity' | 'account'

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

export type SequencerDbSchema = {
  repo_seq: RepoSeq
}
