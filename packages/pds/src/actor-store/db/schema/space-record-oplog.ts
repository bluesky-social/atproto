import type { WriteOpAction } from '@atproto/repo'

export interface SpaceRecordOplog {
  space: string
  rev: string
  idx: number
  action: WriteOpAction
  uri: string
  collection: string
  rkey: string
  cid: string | null
  prev: string | null
}

const tableName = 'space_record_oplog'

export type PartialDB = { [tableName]: SpaceRecordOplog }
