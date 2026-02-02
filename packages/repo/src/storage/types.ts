import { Readable } from 'node:stream'
import { check } from '@atproto/common-web'
import { Cid, LexMap } from '@atproto/lex-data'
import { BlockMap } from '../block-map'
import { CommitData } from '../types'

export interface RepoStorage {
  // Writable
  getRoot(): Promise<Cid | null>
  putBlock(cid: Cid, block: Uint8Array, rev: string): Promise<void>
  putMany(blocks: BlockMap, rev: string): Promise<void>
  updateRoot(cid: Cid, rev: string): Promise<void>
  applyCommit(commit: CommitData)

  // Readable
  getBytes(cid: Cid): Promise<Uint8Array | null>
  has(cid: Cid): Promise<boolean>
  getBlocks(cids: Cid[]): Promise<{ blocks: BlockMap; missing: Cid[] }>
  attemptRead<T>(
    cid: Cid,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array } | null>
  readObjAndBytes<T>(
    cid: Cid,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array }>
  readObj<T>(cid: Cid, def: check.Def<T>): Promise<T>
  attemptReadRecord(cid: Cid): Promise<LexMap | null>
  readRecord(cid: Cid): Promise<LexMap>
}

export interface BlobStore {
  putTemp(bytes: Uint8Array | Readable): Promise<string>
  makePermanent(key: string, cid: Cid): Promise<void>
  putPermanent(cid: Cid, bytes: Uint8Array | Readable): Promise<void>
  quarantine(cid: Cid): Promise<void>
  unquarantine(cid: Cid): Promise<void>
  getBytes(cid: Cid): Promise<Uint8Array>
  getStream(cid: Cid): Promise<Readable>
  hasTemp(key: string): Promise<boolean>
  hasStored(cid: Cid): Promise<boolean>
  delete(cid: Cid): Promise<void>
  deleteMany(cid: Cid[]): Promise<void>
}

export class BlobNotFoundError extends Error {}
