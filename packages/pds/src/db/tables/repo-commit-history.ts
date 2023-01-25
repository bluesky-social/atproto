export interface RepoCommitHistory {
  commit: string
  prev: string | null
  creator: string
}

export const tableName = 'repo_commit_history'

export type PartialDB = { [tableName]: RepoCommitHistory }
