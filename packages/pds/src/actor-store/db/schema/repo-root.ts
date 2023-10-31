export interface RepoRoot {
  cid: string
  rev: string
  indexedAt: string
}

const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
