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
  auth_token: common.cid.nullable(),
  data: common.cid,
})
export type RepoRoot = z.infer<typeof repoRoot>

const commit = z.object({
  root: common.cid,
  sig: common.bytes,
})
export type Commit = z.infer<typeof commit>

export type RecordCreateOp = {
  action: 'create'
  collection: string
  rkey: string
  value: unknown
}

export type RecordUpdateOp = {
  action: 'update'
  collection: string
  rkey: string
  value: unknown
}

export type RecordDeleteOp = {
  action: 'delete'
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

export type CommitData = {
  root: CID
  prev: CID | null
  blocks: BlockMap
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
  list(count: number, after?: string, before?: string): Promise<DataValue[]>
  listWithPrefix(prefix: string, count?: number): Promise<DataValue[]>
  diff(other: DataStore): Promise<DataDiff>
  blockDiff(): Promise<{ root: CID; blocks: BlockMap }>
  writeToCarStream(car: BlockWriter): Promise<void>
}
