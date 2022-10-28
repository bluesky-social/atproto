export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
