export interface SpaceRecordBlob {
  blobCid: string
  recordUri: string
}

const tableName = 'space_record_blob'

export type PartialDB = { [tableName]: SpaceRecordBlob }
