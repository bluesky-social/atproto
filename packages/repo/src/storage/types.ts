import type { Readable } from 'node:stream'
import type { check } from '@atproto/common-web'
import type { Cid, LexMap } from '@atproto/lex-data'
import type { BlockMap } from '../block-map.js'
import type { CommitData } from '../types.js'

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

/**
 * @extends AsyncDisposable Make sure to explicitly dispose of the
 * {@link BlobStoreCreator}
 */
export interface BlobStoreCreator extends AsyncDisposable {
  // @NOTE For historical reason, the creator is a function. A better
  // implementation would probably be to use a class interface.
  (did: string): BlobStore
}

// @TODO make this less node-js specific by using AsyncIterable<Uint8Array> instead of Readable
/**
 * @extends AsyncDisposable Make sure to explicitly dispose of the
 * {@link BlobStore}
 */
export interface BlobStore extends AsyncDisposable {
  putTemp(bytes: Uint8Array | Readable): Promise<string>
  makePermanent(key: string, cid: Cid): Promise<void>
  putPermanent(cid: Cid, bytes: Uint8Array | Readable): Promise<void>
  quarantine(cid: Cid): Promise<void>
  unquarantine(cid: Cid): Promise<void>
  getBytes(cid: Cid): Promise<Uint8Array>
  getStream(cid: Cid): Promise<Readable>
  /** Returns a short-lived attachment download URL for a stored blob, if supported. */
  getDownloadUrl?(cid: Cid, mimeType: string): Promise<string>
  hasTemp(key: string): Promise<boolean>
  hasStored(cid: Cid): Promise<boolean>
  delete(cid: Cid): Promise<void>
  deleteMany(cid: Cid[]): Promise<void>
}

export class BlobNotFoundError extends Error {}
