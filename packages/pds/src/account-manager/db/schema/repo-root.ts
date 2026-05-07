import { DatetimeString } from '@atproto/lex'

export interface RepoRoot {
  did: string
  cid: string
  rev: string
  indexedAt: DatetimeString
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
