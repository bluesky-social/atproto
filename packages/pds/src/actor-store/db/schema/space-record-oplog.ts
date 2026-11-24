import type {
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'

export interface SpaceRecordOplog {
  space: SpaceRefString
  rev: string
  idx: number
  collection: NsidString
  rkey: RecordKeyString
  cid: string | null
  prev: string | null
}

const tableName = 'space_record_oplog'

export type PartialDB = { [tableName]: SpaceRecordOplog }
