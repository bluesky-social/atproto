export interface RepoBlob {
  cid: string
  recordUri: string
  commit: string
  did: string
  takedownId: number | null
}

export const tableName = 'repo_blob'

export type PartialDB = { [tableName]: RepoBlob }
