export interface RepoBlob {
  cid: string
  recordUri: string
  repoRev: string | null
  did: string
  takedownRef: string | null
}

export const tableName = 'repo_blob'

export type PartialDB = { [tableName]: RepoBlob }
