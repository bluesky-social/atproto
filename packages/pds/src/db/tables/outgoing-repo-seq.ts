import { GeneratedAlways } from 'kysely'

export interface OutgoingRepoSeq {
  seq: GeneratedAlways<number>
  eventId: number
}

export const tableName = 'outgoing_repo_seq'

export type PartialDB = { [tableName]: OutgoingRepoSeq }
