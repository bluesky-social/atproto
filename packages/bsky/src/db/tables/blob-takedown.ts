export interface BlobTakedown {
  did: string
  cid: string
  takedownId: string
}

export const tableName = 'blob_takedown'

export type PartialDB = { [tableName]: BlobTakedown }
