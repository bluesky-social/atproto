import { z } from 'zod'
import { schema as common, def as commonDef } from '@atproto/common'
import { CID } from 'multiformats'
import BlockMap from './block-map'
import { RepoRecord } from '@atproto/lexicon'

// Repo nodes
// ---------------

const unsignedCommit = z.object({
  did: z.string(),
  version: z.number(),
  prev: common.cid.nullable(),
  data: common.cid,
})
export type UnsignedCommit = z.infer<typeof unsignedCommit> & { sig?: never }

const commit = z.object({
  did: z.string(),
  version: z.number(),
  prev: common.cid.nullable(),
  data: common.cid,
  sig: common.bytes,
})
export type Commit = z.infer<typeof commit>

export const schema = {
  ...common,
  commit,
}

export const def = {
  ...commonDef,
  commit: {
    name: 'commit',
    schema: schema.commit,
  },
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
  collection: string
  rkey: string
  record: RepoRecord
}

export type RecordUpdateOp = {
  action: WriteOpAction.Update
  collection: string
  rkey: string
  record: RepoRecord
}

export type RecordDeleteOp = {
  action: WriteOpAction.Delete
  collection: string
  rkey: string
}

export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp

export type RecordCreateDescript = RecordCreateOp & {
  cid: CID
}

export type RecordUpdateDescript = RecordUpdateOp & {
  prev: CID
  cid: CID
}

export type RecordDeleteDescript = RecordDeleteOp & {
  cid: CID
}

export type RecordWriteDescript =
  | RecordCreateDescript
  | RecordUpdateDescript
  | RecordDeleteDescript

export type WriteLog = RecordWriteDescript[][]

// Updates/Commits
// ---------------

export type CommitBlockData = {
  commit: CID
  blocks: BlockMap
}

export type CommitData = CommitBlockData & {
  prev: CID | null
}

export type RebaseData = {
  commit: CID
  rebased: CID
  blocks: BlockMap
  preservedCids: CID[]
}

export type CommitCidData = {
  commit: CID
  prev: CID | null
  cids: CID[]
}

export type RepoUpdate = CommitData & {
  ops: RecordWriteOp[]
}

export type CollectionContents = Record<string, RepoRecord>
export type RepoContents = Record<string, CollectionContents>

export type RepoRecordWithCid = { cid: CID; value: RepoRecord }
export type CollectionContentsWithCids = Record<string, RepoRecordWithCid>
export type RepoContentsWithCids = Record<string, CollectionContentsWithCids>

export type DatastoreContents = Record<string, CID>

export type RecordPath = {
  collection: string
  rkey: string
}

export type RecordClaim = {
  collection: string
  rkey: string
  record: RepoRecord | null
}
