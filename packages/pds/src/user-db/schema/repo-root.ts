// @NOTE also used by app-view (moderation)
export interface RepoRoot {
  cid: string
  rev: string
  indexedAt: string
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
