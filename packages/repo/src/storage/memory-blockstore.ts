import { CID } from 'multiformats/cid'
import { CommitData } from '../types'
import BlockMap from '../block-map'
import ReadableBlockstore from './readable-blockstore'
import { RepoStorage } from './types'

export class MemoryBlockstore
  extends ReadableBlockstore
  implements RepoStorage
{
  blocks: BlockMap
  head: CID | null = null

  constructor(blocks?: BlockMap) {
    super()
    this.blocks = new BlockMap()
    if (blocks) {
      this.blocks.addMap(blocks)
    }
  }

  async getHead(): Promise<CID | null> {
    return this.head
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid) || null
  }

  async has(cid: CID): Promise<boolean> {
    return this.blocks.has(cid)
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    return this.blocks.getMany(cids)
  }

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.blocks.set(cid, block)
  }

  async putMany(blocks: BlockMap): Promise<void> {
    this.blocks.addMap(blocks)
  }

  async updateHead(cid: CID): Promise<void> {
    this.head = cid
  }

  async applyCommit(commit: CommitData): Promise<void> {
    this.head = commit.cid
    const rmCids = commit.removedCids.toList()
    for (const cid of rmCids) {
      this.blocks.delete(cid)
    }
    commit.leafBlocks.forEach((bytes, cid) => {
      this.blocks.set(cid, bytes)
    })
    commit.repoBlocks.forEach((bytes, cid) => {
      this.blocks.set(cid, bytes)
    })
  }

  async sizeInBytes(): Promise<number> {
    let total = 0
    this.blocks.forEach((bytes) => {
      total += bytes.byteLength
    })
    return total
  }

  async destroy(): Promise<void> {
    this.blocks.clear()
  }
}

export default MemoryBlockstore
