import type { DatetimeString } from '@atproto/lex-schema'

export interface RepoRoot {
  did: string
  cid: string
  rev: string
  indexedAt: DatetimeString
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
