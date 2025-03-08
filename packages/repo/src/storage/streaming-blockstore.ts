import { CarBlockIterator } from '@ipld/car/iterator'
import { CID } from 'multiformats/cid'
import { BlockMap } from '../block-map'
import { CarBlock } from '../types'
import * as util from '../util'
import { ReadableBlockstore } from './readable-blockstore'

export class StreamingBlockstore extends ReadableBlockstore {
  rev: string | null = null

  constructor(
    private root: CID,
    private blockStream: AsyncGenerator<CarBlock>,
  ) {
    super()
  }

  static async create(carStream: AsyncIterable<Uint8Array>) {
    const car = await CarBlockIterator.fromIterable(carStream)
    const roots = await car.getRoots()
    if (roots.length !== 1) {
      throw new Error('expected one root')
    }
    const root = roots[0]
    const blockStream = util.verifyIncomingCarBlocks(car)
    return new StreamingBlockstore(root, blockStream)
  }

  async getRoot(): Promise<CID | null> {
    return this.root
  }

  async getBytes(cid: CID): Promise<Uint8Array | null> {
    const block = await this.blockStream.next()
    if (block.done) {
      throw new Error('no more blocks')
    }
    if (!block.value.cid.equals(cid)) {
      throw new Error('cid does not match next block')
    }
    return block.value.bytes
  }

  async has(): Promise<boolean> {
    return false
  }

  async getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }> {
    return { missing: cids, blocks: new BlockMap() }
  }
}

export default StreamingBlockstore
