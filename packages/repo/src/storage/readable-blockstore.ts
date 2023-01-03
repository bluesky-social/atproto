import { check } from '@atproto/common'
import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import { MissingBlockError } from '../error'
import * as parse from '../parse'

export abstract class ReadableBlockstore {
  abstract getBytes(cid: CID): Promise<Uint8Array | null>
  abstract has(cid: CID): Promise<boolean>
  abstract getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }>

  async readObjAndBytes<T>(
    cid: CID,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array }> {
    const bytes = await this.getBytes(cid)
    if (!bytes) {
      throw new MissingBlockError(cid, def)
    }
    return parse.parseObj(bytes, cid, def)
  }

  async readObj<T>(cid: CID, def: check.Def<T>): Promise<T> {
    const obj = await this.readObjAndBytes(cid, def)
    return obj.obj
  }
}

export default ReadableBlockstore
