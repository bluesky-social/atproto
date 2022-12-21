import { CID } from 'multiformats/cid'
import RepoStorage from './repo-storage'
import { def } from '../types'

export class MemoryBlockstore extends RepoStorage {
  blocks: Map<string, Uint8Array>

  constructor() {
    super()
    this.blocks = new Map()
  }

  async getSavedBytes(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid.toString()) || null
  }

  async hasSavedBlock(cid: CID): Promise<boolean> {
    return this.blocks.has(cid.toString())
  }

  async putBlock(cid: CID, block: Uint8Array): Promise<void> {
    this.blocks.set(cid.toString(), block)
  }

  async putMany(blocks: Map<string, Uint8Array>): Promise<void> {
    blocks.forEach((val, key) => {
      this.blocks.set(key, val)
    })
  }

  async commitStaged(_commit: CID): Promise<void> {
    await this.putMany(this.staged)
    this.clearStaged()
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

  async sizeInBytes(): Promise<number> {
    let total = 0
    for (const val of this.blocks.values()) {
      total += val.byteLength
    }
    return total
  }

  async destroySaved(): Promise<void> {
    this.blocks.clear()
  }

  // Mainly for dev purposes
  async getContents(): Promise<Record<string, unknown>> {
    const contents: Record<string, unknown> = {}
    for (const key of this.blocks.keys()) {
      contents[key] = await this.getUnchecked(CID.parse(key))
    }
    return contents
  }
}

export default MemoryBlockstore
