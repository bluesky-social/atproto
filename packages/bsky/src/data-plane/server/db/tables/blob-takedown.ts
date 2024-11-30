export interface BlobTakedown {
  did: string
  cid: string
  takedownRef: string
}

export const tableName = 'blob_takedown'

export type PartialDB = { [tableName]: BlobTakedown }
