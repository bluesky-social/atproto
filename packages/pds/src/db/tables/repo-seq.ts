import { Generated } from 'kysely'

export interface RepoSeq {
  seq: Generated<number>
  did: string
  commit: string
}

export const tableName = 'repo_seq'

export type PartialDB = { [tableName]: RepoSeq }
