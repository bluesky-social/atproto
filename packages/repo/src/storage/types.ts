import stream from 'stream'
import { CID } from 'multiformats/cid'
import { RepoRecord } from '@atproto/lexicon'
import { check } from '@atproto/common'
import BlockMap from '../block-map'
import { CommitData } from '../types'

export interface RepoStorage {
  // Writable
  getRoot(): Promise<CID | null>
  putBlock(cid: CID, block: Uint8Array, rev: string): Promise<void>
  putMany(blocks: BlockMap, rev: string): Promise<void>
  updateRoot(cid: CID): Promise<void>
  applyCommit(commit: CommitData)

  // Readable
  getBytes(cid: CID): Promise<Uint8Array | null>
  has(cid: CID): Promise<boolean>
  getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }>
  attemptRead<T>(
    cid: CID,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array } | null>
  readObjAndBytes<T>(
    cid: CID,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array }>
  readObj<T>(cid: CID, def: check.Def<T>): Promise<T>
  attemptReadRecord(cid: CID): Promise<RepoRecord | null>
  readRecord(cid: CID): Promise<RepoRecord>
}

export interface BlobStore {
  putTemp(bytes: Uint8Array | stream.Readable): Promise<string>
  makePermanent(key: string, cid: CID): Promise<void>
  putPermanent(cid: CID, bytes: Uint8Array | stream.Readable): Promise<void>
  quarantine(cid: CID): Promise<void>
  unquarantine(cid: CID): Promise<void>
  getBytes(cid: CID): Promise<Uint8Array>
  getStream(cid: CID): Promise<stream.Readable>
  hasStored(cid: CID): Promise<boolean>
  delete(cid: CID): Promise<void>
}

export class BlobNotFoundError extends Error {}
