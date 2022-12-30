import stream from 'stream'
import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import { CommitBlockData, CommitData } from '../types'

export interface WritableBlockstore {
  putBlock(cid: CID, block: Uint8Array): Promise<void>
  putMany(blocks: BlockMap): Promise<void>
}

export interface ReadableBlockstore {
  getBytes(cid: CID): Promise<Uint8Array | null>
  getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }>
  has(cid: CID): Promise<boolean>
  checkMissing(cids: CID[]): Promise<CID[]>
}

export interface CommitableStorage {
  updateHead(cid: CID): Promise<void>
  indexCommits(commit: CommitData[]): Promise<void>
  applyCommit(commit: CommitData): Promise<void>
  getHead(forUpdate?: boolean): Promise<CID | null>
  getCommitPath(latest: CID, earliest: CID | null): Promise<CID[] | null>
  getBlocksForCommits(commits: CID[]): Promise<{ [commit: string]: BlockMap }>
  getCommits(
    latest: CID,
    earliest: CID | null,
  ): Promise<CommitBlockData[] | null>
}

export interface RepoStorage
  extends CommitableStorage,
    WritableBlockstore,
    ReadableBlockstore {}

export interface BlobStore {
  putTemp(bytes: Uint8Array | stream.Readable): Promise<string>
  makePermanent(key: string, cid: CID): Promise<void>
  putPermanent(cid: CID, bytes: Uint8Array | stream.Readable): Promise<void>
  getBytes(cid: CID): Promise<Uint8Array>
  getStream(cid: CID): Promise<stream.Readable>
}

export class BlobNotFoundError extends Error {}
