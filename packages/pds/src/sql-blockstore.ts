import { IpldStore } from '@atproto/repo'
import { CID } from 'multiformats/cid'
import Database from './db'

export class SqlBlockstore extends IpldStore {
  constructor(
    public db: Database,
    public did: string,
    public timestamp?: string,
  ) {
    super()
  }

  async has(cid: CID): Promise<boolean> {
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('cid')
      .executeTakeFirst()
    return !!found
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const found = await this.db.db
      .selectFrom('ipld_block')
      .where('cid', '=', cid.toString())
      .select('content')
      .executeTakeFirst()
    if (!found) throw new Error(`Not found: ${cid.toString()}`)
    return found.content
  }

  async putBytes(cid: CID, bytes: Uint8Array): Promise<void> {
    this.db.assertTransaction()
    const insertBlock = this.db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        size: bytes.length,
        content: bytes,
        indexedAt: this.timestamp || new Date().toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    const insertBlockOwner = this.db.db
      .insertInto('ipld_block_creator')
      .values({ cid: cid.toString(), did: this.did })
      .onConflict((oc) => oc.doNothing())
      .execute()
    await Promise.all([insertBlock, insertBlockOwner])
  }

  destroy(): Promise<void> {
    throw new Error('Destruction of SQL blockstore not allowed at runtime')
  }
}

export default SqlBlockstore
