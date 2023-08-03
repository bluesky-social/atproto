// @NOTE also used by app-view (moderation)
export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
  takedownId: number | null
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
