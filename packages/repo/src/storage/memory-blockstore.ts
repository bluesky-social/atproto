import { CID } from 'multiformats/cid'
import RepoStorage from './repo-storage'
import { CommitData, def } from '../types'
import BlockMap from '../block-map'
import { MST } from '../mst'

export class MemoryBlockstore extends RepoStorage {
  blocks: BlockMap
  head: CID | null = null

  constructor() {
    super()
    this.blocks = new BlockMap()
  }

  async getHead(): Promise<CID | null> {
    return this.head
  }

  async getSavedBytes(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid) || null
  }

  async getMany(cids: CID[]): Promise<BlockMap> {
    const blocks = new BlockMap()
    await Promise.all(
      cids.map(async (cid) => {
        const bytes = await this.getBytes(cid)
        if (bytes) {
          blocks.set(cid, bytes)
        }
      }),
    )
    return blocks
  }

  async getManySavedBytes(cids: CID[]): Promise<BlockMap> {
    return cids.reduce((acc, cur) => {
      const got = this.blocks.get(cur)
      if (got) {
        acc.set(cur, got)
      }
      return acc
    }, new BlockMap())
  }

  async hasSavedBytes(cid: CID): Promise<boolean> {
    return this.blocks.has(cid)
  }

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.blocks.set(cid, block)
  }

  async putMany(blocks: BlockMap): Promise<void> {
    blocks.forEach((val, key) => {
      this.blocks.set(key, val)
    })
  }

  async applyCommit(commit: CommitData): Promise<void> {
    this.blocks.addMap(commit.blocks)
    this.head = commit.root
  }

  async getCommitPath(
    latest: CID,
    earliest: CID | null,
  ): Promise<CID[] | null> {
    let curr: CID | null = latest
    const path: CID[] = []
    while (curr !== null) {
      path.push(curr)
      const commit = await this.get(curr, def.commit)
      if (earliest && curr.equals(earliest)) {
        return path.reverse()
      }
      const root = await this.get(commit.root, def.repoRoot)
      if (!earliest && root.prev === null) {
        return path.reverse()
      }
      curr = root.prev
    }
    return null
  }

  async getBlocksForCommits(
    commits: CID[],
  ): Promise<{ [commit: string]: BlockMap }> {
    const commitData: { [commit: string]: BlockMap } = {}
    let prevData: MST | null = null
    for (const commitCid of commits) {
      const commit = await this.get(commitCid, def.commit)
      const root = await this.get(commit.root, def.repoRoot)
      const data = await MST.load(this, root.data)
      const newCids = prevData
        ? (await prevData.diff(data)).newCidList()
        : (await data.allCids()).toList()
      const blocks = await this.getMany([commitCid, commit.root, ...newCids])
      if (!root.prev) {
        const metaBytes = await this.guaranteeBytes(root.meta)
        blocks.set(root.meta, metaBytes)
      }
      commitData[commitCid.toString()] = blocks
      prevData = data
    }
    return commitData
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

  // Mainly for dev purposes
  async getContents(): Promise<Record<string, unknown>> {
    const contents: Record<string, unknown> = {}
    for (const entry of this.blocks.entries()) {
      contents[entry.cid.toString()] = await this.getUnchecked(entry.cid)
    }
    return contents
  }
}

export default MemoryBlockstore
