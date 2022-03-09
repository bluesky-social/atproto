import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import { did, cid, bytes } from '../common/types.js'
import TID from './tid.js'
import { z } from 'zod'

export const tid = z.instanceof(TID)

export const userRoot = z.object({
  did: did,
  programs: z.record(cid),
})
export type UserRoot = z.infer<typeof userRoot>

export const programRoot = z.object({
  posts: cid,
  relationships: cid,
  interactions: cid,
  profile: cid.nullable(),
})
export type ProgramRoot = z.infer<typeof programRoot>

export const commit = z.object({
  root: cid,
  prev: cid.nullable(),
  added: z.array(cid),
  sig: bytes,
})
export type Commit = z.infer<typeof commit>

export const idMapping = z.record(cid)
export type IdMapping = z.infer<typeof idMapping>

export const entry = z.object({
  tid: tid,
  cid: cid,
})
export type Entry = z.infer<typeof entry>

export const newCids = z.set(cid)
export type NewCids = z.infer<typeof newCids>

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
