export interface SpaceRecordBlob {
  space: string
  collection: string
  rkey: string
  blobCid: string
}

const tableName = 'space_record_blob'

export type PartialDB = { [tableName]: SpaceRecordBlob }
