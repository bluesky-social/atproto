export interface RepoBlob {
  cid: string
  recordUri: string
  repoRev: string
}

export const tableName = 'repo_blob'

export type PartialDB = { [tableName]: RepoBlob }
