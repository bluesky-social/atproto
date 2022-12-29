import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
import { def as common } from '@atproto/common'
import { CID } from 'multiformats'
import { DataDiff } from './mst'
import BlockMap from './block-map'

const repoMeta = z.object({
  did: z.string(),
  version: z.number(),
  datastore: z.string(),
})
export type RepoMeta = z.infer<typeof repoMeta>

const repoRoot = z.object({
  meta: common.cid,
  prev: common.cid.nullable(),
  auth_token: common.cid.nullable().optional(),
  data: common.cid,
})
export type RepoRoot = z.infer<typeof repoRoot>

const commit = z.object({
  root: common.cid,
  sig: common.bytes,
})
export type Commit = z.infer<typeof commit>

export enum WriteOpAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type CidCreateOp = {
  action: WriteOpAction.Create
  collection: string
  rkey: string
  value: CID
}

export type CidUpdateOp = {
  action: WriteOpAction.Update
  collection: string
  rkey: string
  value: CID
}

export type CidDeleteOp = {
  action: WriteOpAction.Delete
  collection: string
  rkey: string
}

export type CidWriteOp = CidCreateOp | CidUpdateOp | CidDeleteOp

export type RecordCreateOp = {
  action: WriteOpAction.Create
  collection: string
  rkey: string
  value: Record<string, unknown>
}

export type RecordUpdateOp = {
  action: WriteOpAction.Update
  collection: string
  rkey: string
  value: Record<string, unknown>
}

export type RecordDeleteOp = {
  action: WriteOpAction.Delete
  collection: string
  rkey: string
}

export type RecordWriteOp = RecordCreateOp | RecordUpdateOp | RecordDeleteOp

export const def = {
  ...common,
  repoMeta,
  repoRoot,
  commit,
}

export type CommitBlockData = {
  root: CID
  blocks: BlockMap
}

export type CommitData = CommitBlockData & {
  prev: CID | null
}

export type RepoUpdate = CommitData & {
  ops: RecordWriteOp[]
}

export interface CarStreamable {
  writeToCarStream(car: BlockWriter): Promise<void>
}

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
  diff(other: DataStore): Promise<DataDiff>
  blockDiff(): Promise<{ root: CID; blocks: BlockMap }>
  writeToCarStream(car: BlockWriter): Promise<void>
}
