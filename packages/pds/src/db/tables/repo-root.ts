// @NOTE also used by app-view (moderation)
export interface RepoRoot {
  did: string
  root: string
  indexedAt: string
  // opaque identifier, though currently tends to reference a moderation_action
  takedownId: string | null
}

export const tableName = 'repo_root'

export type PartialDB = { [tableName]: RepoRoot }
