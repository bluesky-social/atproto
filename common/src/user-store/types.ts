import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import { DID } from '../common/types.js'
import TID from './tid.js'

export type UserRoot = Record<string, CID> & { did: DID }

export type ProgramRoot = {
  posts: CID
  relationships: CID
  interactions: CID
  profile: CID | null
}

export type Commit = {
  root: CID
  sig: Uint8Array
}

export type IdMapping = Record<string, CID>

export type Entry = {
  tid: TID
  cid: CID
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
