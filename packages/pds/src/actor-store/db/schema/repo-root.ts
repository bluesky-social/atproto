export interface RepoRoot {
  did: string
  cid: string
  rev: string
  indexedAt: string
}

const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
