import type { AtUriString } from '@atproto/syntax'

export interface SpaceRecordBlob {
  blobCid: string
  recordUri: AtUriString
}

const tableName = 'space_record_blob'

export type PartialDB = { [tableName]: SpaceRecordBlob }
