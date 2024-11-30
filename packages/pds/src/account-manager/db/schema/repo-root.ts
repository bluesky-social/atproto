export interface RepoRoot {
  did: string
  cid: string
  rev: string
  indexedAt: string
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
