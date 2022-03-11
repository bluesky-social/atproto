import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import { schema as common } from '../common/types.js'
import TID from './tid.js'

const tid = z.instanceof(TID)

const userRoot = z.object({
  did: common.did,
  prev: common.cid.nullable(),
  added: z.array(common.cid),
  programs: z.record(common.cid),
})
export type UserRoot = z.infer<typeof userRoot>

const programRoot = z.object({
  posts: common.cid,
  relationships: common.cid,
  interactions: common.cid,
  profile: common.cid.nullable(),
})
export type ProgramRoot = z.infer<typeof programRoot>

const commit = z.object({
  root: common.cid,
  sig: common.bytes,
})
export type Commit = z.infer<typeof commit>

const idMapping = z.record(common.cid)
export type IdMapping = z.infer<typeof idMapping>

const entry = z.object({
  tid: tid,
  cid: common.cid,
})
export type Entry = z.infer<typeof entry>

const newCids = z.set(common.cid)
export type NewCids = z.infer<typeof newCids>

export const schema = {
  ...common,
  tid,
  userRoot,
  programRoot,
  commit,
  idMapping,
  entry,
  newCids,
}

export interface CarStreamable {
  writeToCarStream(car: BlockWriter): Promise<void>
}

export interface Collection<T> {
  getEntry(id: T): Promise<CID | null>
  addEntry(id: T, cid: CID): Promise<void>
  editEntry(id: T, cid: CID): Promise<void>
  deleteEntry(id: T): Promise<void>
  cids(): Promise<CID[]>
}
