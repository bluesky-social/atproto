import { IpldStore } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from './db'
import { IpldBlock } from './db/tables/ipld-block'
import { IpldBlockCreator } from './db/tables/ipld-block-creator'

export class SqlBlockstore extends IpldStore {
  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {
    super()
  }

  async getSavedBytes(cid: CID): Promise<Uint8Array | null> {
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    return found ? found.content : null
  }

  async hasSavedBlock(cid: CID): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('cid')
      .executeTakeFirst()
    return !!found
  }

  async saveStaged(): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    const creators: IpldBlockCreator[] = []
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

  async destroySaved(): Promise<void> {
    throw new Error('Destruction of SQL blockstore not allowed at runtime')
  }
}

export default SqlBlockstore
