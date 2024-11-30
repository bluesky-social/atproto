export interface RecordBlob {
  blobCid: string
  recordUri: string
}

export const tableName = 'record_blob'

export type PartialDB = { [tableName]: RecordBlob }
