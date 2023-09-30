export interface RepoBlob {
  cid: string
  recordUri: string
  repoRev: string | null
  did: string
  takedownId: number | null
}

export const tableName = 'repo_blob'

export type PartialDB = { [tableName]: RepoBlob }
