import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import ReadableBlockstore from './readable-blockstore'

export class SyncStorage extends ReadableBlockstore {
  constructor(
    public staged: ReadableBlockstore,
    public saved: ReadableBlockstore,
  ) {
    super()
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const got = await this.staged.getBytes(cid)
    if (got) return got
    return this.saved.getBytes(cid)
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    const fromStaged = await this.staged.getBlocks(cids)
    const fromSaved = await this.saved.getBlocks(fromStaged.missing)
    const blocks = fromStaged.blocks
    blocks.addMap(fromSaved.blocks)
    return {
      blocks,
      missing: fromSaved.missing,
    }
  }

  async has(cid: CID): Promise<boolean> {
    return (await this.staged.has(cid)) || (await this.saved.has(cid))
  }
}

export default SyncStorage
