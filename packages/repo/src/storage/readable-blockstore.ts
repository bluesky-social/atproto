import { check } from '@atproto/common-web'
import { Cid, LexMap } from '@atproto/lex-data'
import { BlockMap } from '../block-map'
import { MissingBlockError } from '../error'
import { parseObjByDef } from '../parse'
import { cborToLexRecord } from '../util'

export abstract class ReadableBlockstore {
  abstract getBytes(cid: Cid): Promise<Uint8Array | null>
  abstract has(cid: Cid): Promise<boolean>
  abstract getBlocks(cids: Cid[]): Promise<{ blocks: BlockMap; missing: Cid[] }>

  async attemptRead<T>(
    cid: Cid,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array } | null> {
    const bytes = await this.getBytes(cid)
    if (!bytes) return null
    return parseObjByDef(bytes, cid, def)
  }

  async readObjAndBytes<T>(
    cid: Cid,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array }> {
    const read = await this.attemptRead(cid, def)
    if (!read) {
      throw new MissingBlockError(cid, def.name)
    }
    return read
  }

  async readObj<T>(cid: Cid, def: check.Def<T>): Promise<T> {
    const obj = await this.readObjAndBytes(cid, def)
    return obj.obj
  }

  async attemptReadRecord(cid: Cid): Promise<LexMap | null> {
    try {
      return await this.readRecord(cid)
    } catch {
      return null
    }
  }

  async readRecord(cid: Cid): Promise<LexMap> {
    const bytes = await this.getBytes(cid)
    if (!bytes) {
      throw new MissingBlockError(cid)
    }
    return cborToLexRecord(bytes)
  }
}

export default ReadableBlockstore
