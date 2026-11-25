import type {
  AtUriString,
  NsidString,
  RecordKeyString,
  SpaceRefString,
} from '@atproto/syntax'

export interface SpaceRecord {
  uri: AtUriString
  space: SpaceRefString
  collection: NsidString
  rkey: RecordKeyString
  cid: string
  value: Uint8Array
  repoRev: string
  indexedAt: string
}

const tableName = 'space_record'

export type PartialDB = { [tableName]: SpaceRecord }
