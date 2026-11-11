import { BlockMap, type CarBlock } from '@atproto/car'
import type { Cid } from '@atproto/lex-data'
import type { CommitData } from '../types.js'
import { ReadableBlockstore } from './readable-blockstore.js'
import type { RepoStorage } from './types.js'

export class MemoryBlockstore
  extends ReadableBlockstore
  implements RepoStorage
{
  blocks = new BlockMap<Cid>()
  root: Cid | null = null
  rev: string | null = null

  constructor(blocks?: Iterable<Readonly<CarBlock>>) {
    super()
    if (blocks) this.blocks.addBlocks(blocks)
  }

  async getRoot(): Promise<Cid | null> {
    return this.root
  }

  async getBytes(cid: Cid): Promise<Uint8Array | null> {
    return this.blocks.get(cid) || null
  }

  async has(cid: Cid): Promise<boolean> {
    return this.blocks.has(cid)
  }

  async getBlocks(cids: Iterable<Cid>): Promise<{
    blocks: BlockMap<Cid>
    missing: Cid[]
  }> {
    return this.blocks.getMany(cids)
  }

  async putBlock(cid: Cid, block: Uint8Array): Promise<void> {
    this.blocks.set(cid, block)
  }

  async putMany(blocks: Iterable<Readonly<CarBlock>>): Promise<void> {
    this.blocks.addBlocks(blocks)
  }

  async updateRoot(cid: Cid, rev: string): Promise<void> {
    this.root = cid
    this.rev = rev
  }

  async applyCommit(commit: CommitData): Promise<void> {
    this.root = commit.cid
    for (const cid of commit.removedCids) {
      this.blocks.delete(cid)
    }
    for (const { cid, bytes } of commit.newBlocks) {
      this.blocks.set(cid, bytes)
    }
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    for (const bytes of this.blocks.values()) {
      total += bytes.byteLength
    }
    return total
  }

  async destroy(): Promise<void> {
    this.blocks.clear()
  }
}

export default MemoryBlockstore
