import { IpldStore } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from './db'
import { IpldBlock } from './db/tables/ipld-block'
import { IpldBlockCreator } from './db/tables/ipld-block-creator'

export class SqlBlockstore extends IpldStore {
  staged: Map<string, Uint8Array>

  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {
    super()
    this.staged = new Map()
  }

  async has(cid: CID): Promise<boolean> {
    if (this.staged.has(cid.toString())) return true
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('cid')
      .executeTakeFirst()
    return !!found
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const foundStaged = this.staged.get(cid.toString())
    if (foundStaged) return foundStaged
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    if (found) return found.content
    throw new Error(`Not found: ${cid.toString()}`)
  }

  async stageBytes(k: CID, v: Uint8Array): Promise<void> {
    this.staged.set(k.toString(), v)
  }

  async saveStaged(): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    const creators: IpldBlockCreator[] = []
    // const promises: Promise<any>[] = []
    for (const staged of this.staged.entries()) {
      const [cid, bytes] = staged
      blocks.push({
        cid: cid.toString(),
        size: bytes.length,
        content: bytes,
        indexedAt: this.timestamp || new Date().toISOString(),
      })
      creators.push({
        cid: cid.toString(),
        did: this.did,
      })
    }
    const insertBlocks = this.db.db
      .insertInto('ipld_block')
      .values(blocks)
      .onConflict((oc) => oc.doNothing())
      .execute()
    const insertCreators = this.db.db
      .insertInto('ipld_block_creator')
      .values(creators)
      .onConflict((oc) => oc.doNothing())
      .execute()
    await Promise.all([insertBlocks, insertCreators])
    this.clearStaged()
  }

  async clearStaged(): Promise<void> {
    this.staged.clear()
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL blockstore not allowed at runtime')
  }
}

export default SqlBlockstore
