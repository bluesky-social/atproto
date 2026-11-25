import type { BlockMap } from '@atproto/car'
import { check } from '@atproto/common-web'
import type { Cid, LexMap } from '@atproto/lex-data'
import type { NsidString, RecordKeyString } from '@atproto/syntax'
import type { CidSet } from './cid-set.js'
import {
  bytesSchema,
  carHeaderSchema,
  cidSchema,
  commitSchema,
  legacyV2CommitSchema,
  mapSchema,
  stringSchema,
  unknownSchema,
  versionedCommitSchema,
} from './schemas.js'

// Repo nodes
// ---------------

export type { Cid }
const cid = check.buildDef('cid', cidSchema)

export type UnsignedCommit = Omit<Commit, 'sig'> & { sig?: never }

const commit = check.buildDef('commit', commitSchema)
export type Commit = check.InferDef<typeof commit>

const legacyV2Commit = check.buildDef('legacyV2Commit', legacyV2CommitSchema)
export type LegacyV2Commit = check.InferDef<typeof legacyV2Commit>

const versionedCommit = check.buildDef('versionedCommit', versionedCommitSchema)
export type VersionedCommit = check.InferDef<typeof versionedCommit>

const carHeader = check.buildDef('CAR header', carHeaderSchema)
export type CarHeader = check.InferDef<typeof carHeader>

const bytes = check.buildDef('bytes', bytesSchema)
export type Bytes = check.InferDef<typeof bytes>

const string = check.buildDef('string', stringSchema)
export type String = check.InferDef<typeof string>

const map = check.buildDef('map', mapSchema)
export type Map = check.InferDef<typeof map>

const unknown = check.buildDef('unknown', unknownSchema)
export type Unknown = check.InferDef<typeof unknown>

export const def = {
  cid,
  carHeader,
  bytes,
  string,
  map,
  unknown,
  commit,
  legacyV2Commit,
  versionedCommit,
}

// Repo Operations
// ---------------

export enum WriteOpAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type RecordCreateOp = {
  action: WriteOpAction.Create
  collection: NsidString
  rkey: RecordKeyString
  record: LexMap
}

export type RecordUpdateOp = {
  action: WriteOpAction.Update
  collection: NsidString
  rkey: RecordKeyString
  record: LexMap
}

export type RecordDeleteOp = {
  action: WriteOpAction.Delete
  collection: NsidString
  rkey: RecordKeyString
}

export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp

export type RecordCreateDescript = {
  action: WriteOpAction.Create
  collection: NsidString
  rkey: RecordKeyString
  cid: Cid
}

export type RecordUpdateDescript = {
  action: WriteOpAction.Update
  collection: NsidString
  rkey: RecordKeyString
  prev: Cid
  cid: Cid
}

export type RecordDeleteDescript = {
  action: WriteOpAction.Delete
  collection: NsidString
  rkey: RecordKeyString
  cid: Cid
}

export type RecordWriteDescript =
  RecordCreateDescript | RecordUpdateDescript | RecordDeleteDescript

export type WriteLog = RecordWriteDescript[][]

// Updates/Commits
// ---------------

export type CommitData = {
  cid: Cid
  rev: string
  since: string | null
  prev: Cid | null
  newBlocks: BlockMap
  relevantBlocks: BlockMap
  removedCids: CidSet
}

export type RepoUpdate = CommitData & {
  ops: RecordWriteOp[]
}

export type CollectionContents = Record<string, LexMap>
export type RepoContents = Record<NsidString, CollectionContents>

export type RepoRecordWithCid = { cid: Cid; value: LexMap }
export type CollectionContentsWithCids = Record<string, RepoRecordWithCid>
export type RepoContentsWithCids = Record<string, CollectionContentsWithCids>

export type DatastoreContents = Record<string, Cid>

export type RecordPath = {
  collection: string
  rkey: string
}

export type RecordCidClaim = {
  collection: string
  rkey: string
  cid: Cid | null
}

export type RecordClaim = {
  collection: string
  rkey: string
  record: LexMap | null
}

// Sync
// ---------------

export type VerifiedDiff = {
  writes: RecordWriteDescript[]
  commit: CommitData
}

export type VerifiedRepo = {
  creates: RecordCreateDescript[]
  commit: CommitData
}
