export interface TempRepoBlob {
  tempKey: string
  cid: string
  did: string
  mimeType: string
  createdAt: string
}

export const tableName = 'temp_repo_blob'

export type PartialDB = { [tableName]: TempRepoBlob }
