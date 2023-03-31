import { check } from '@atproto/common'
import { RepoRecord } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import { MissingBlockError } from '../error'
import * as parse from '../parse'
import { cborToLexRecord } from '../util'

export abstract class ReadableBlockstore {
  abstract getBytes(cid: CID): Promise<Uint8Array | null>
  abstract has(cid: CID): Promise<boolean>
  abstract getBlocks(cids: CID[]): Promise<{ blocks: BlockMap; missing: CID[] }>

  async attemptRead<T>(
    cid: CID,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array } | null> {
    const bytes = await this.getBytes(cid)
    if (!bytes) return null
    return parse.parseObjByDef(bytes, cid, def)
  }

  async readObjAndBytes<T>(
    cid: CID,
    def: check.Def<T>,
  ): Promise<{ obj: T; bytes: Uint8Array }> {
    const read = await this.attemptRead(cid, def)
    if (!read) {
      throw new MissingBlockError(cid, def.name)
    }
    return read
  }

  async readObj<T>(cid: CID, def: check.Def<T>): Promise<T> {
    const obj = await this.readObjAndBytes(cid, def)
    return obj.obj
  }

  async attemptReadRecord(cid: CID): Promise<RepoRecord | null> {
    try {
      return await this.readRecord(cid)
    } catch {
      return null
    }
  }

  async readRecord(cid: CID): Promise<RepoRecord> {
    const bytes = await this.getBytes(cid)
    if (!bytes) {
      throw new MissingBlockError(cid)
    }
    return cborToLexRecord(bytes)
  }
}

export default ReadableBlockstore
