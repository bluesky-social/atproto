import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
import { def as common } from '@atproto/common'
import { CID } from 'multiformats'
import { DataDiff } from './mst'

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

export const cidCreateOp = z.object({
  action: z.literal('create'),
  collection: z.string(),
  rkey: z.string(),
  cid: common.cid,
})

export const cidUpdateOp = z.object({
  action: z.literal('update'),
  collection: z.string(),
  rkey: z.string(),
  cid: common.cid,
})

export const deleteOp = z.object({
  action: z.literal('delete'),
  collection: z.string(),
  rkey: z.string(),
})

export const cidWriteOp = z.union([cidCreateOp, cidUpdateOp, deleteOp])
export type CidWriteOp = z.infer<typeof cidWriteOp>

export const recordCreateOp = z.object({
  action: z.literal('create'),
  collection: z.string(),
  rkey: z.string(),
  value: z.any(),
})
export type RecordCreateOp = z.infer<typeof recordCreateOp>

export const recordUpdateOp = z.object({
  action: z.literal('update'),
  collection: z.string(),
  rkey: z.string(),
  value: z.any(),
})
export type RecordUpdateOp = z.infer<typeof recordUpdateOp>

export const recordWriteOp = z.union([recordCreateOp, recordUpdateOp, deleteOp])
export type RecordWriteOp = z.infer<typeof recordWriteOp>

export const def = {
  ...common,
  repoMeta,
  repoRoot,
  commit,
  cidWriteOp,
  recordWriteOp,
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
  save(): Promise<CID>
  writeToCarStream(car: BlockWriter): Promise<void>
}
