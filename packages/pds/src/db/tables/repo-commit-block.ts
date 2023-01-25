export interface RepoCommitBlock {
  commit: string
  block: string
  creator: string
}

export const tableName = 'repo_commit_block'

export type PartialDB = { [tableName]: RepoCommitBlock }
