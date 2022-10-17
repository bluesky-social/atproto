import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
import { def as common, TID } from '@adxp/common'
import { CID } from 'multiformats'
import { DataDiff } from './mst'

const tid = z.instanceof(TID)

const strToTid = z
  .string()
  .refine(TID.is, { message: 'Not a valid TID' })
  .transform(TID.fromStr)

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

export const batchWriteCreate = z.object({
  action: z.literal('create'),
  collection: z.string(),
  value: z.any(),
})

export const batchWriteUpdate = z.object({
  action: z.literal('update'),
  collection: z.string(),
  tid: z.string(),
  value: z.any(),
})

export const batchWriteDelete = z.object({
  action: z.literal('delete'),
  collection: z.string(),
  tid: z.string(),
})

export const batchWrite = z.union([
  batchWriteCreate,
  batchWriteUpdate,
  batchWriteDelete,
])
export type BatchWrite = z.infer<typeof batchWrite>

export const def = {
  ...common,
  tid,
  strToTid,
  repoMeta,
  repoRoot,
  commit,
  batchWrite,
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
