// @NOTE also used by app-view (moderation)
export interface RepoRoot {
  did: string
  root: string
  rev: string
  indexedAt: string
  takedownId: string | null
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
