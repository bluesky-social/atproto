import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
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

export type RepoUpdate = CommitData & {
  ops: RecordWriteOp[]
}

export type CollectionContents = Record<string, RepoRecord>
export type RepoContents = Record<string, CollectionContents>

export type RecordPath = {
  collection: string
  rkey: string
}

export type RecordClaim = {
  collection: string
  rkey: string
  record: RepoRecord | null
}

// DataStores
// ---------------

export type DataValue = {
  key: string
  value: CID
}

export interface DataStore {
  add(key: string, value: CID): Promise<DataStore>
  update(key: string, value: CID): Promise<DataStore>
  delete(key: string): Promise<DataStore>
  get(key: string): Promise<CID | null>
  list(count?: number, after?: string, before?: string): Promise<DataValue[]>
  listWithPrefix(prefix: string, count?: number): Promise<DataValue[]>
  getUnstoredBlocks(): Promise<{ root: CID; blocks: BlockMap }>
  writeToCarStream(car: BlockWriter): Promise<void>
  cidsForPath(key: string): Promise<CID[]>
}
