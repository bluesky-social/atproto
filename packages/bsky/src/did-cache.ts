import { CacheResult, DidCache, DidDocument } from '@atproto/did-resolver'
import Database from './db'

export class DidSqlCache extends DidCache {
  constructor(public db: Database, public ttl: number) {
    super()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    await this.db.db
      .insertInto('did_cache')
      .values({ did, doc })
      .executeTakeFirst()
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    const res = await this.db.db
      .selectFrom('did_cache')
      .where('did', '=', did)
      .selectAll()
      .executeTakeFirst()
    if (!res) return null
    const now = Date.now()
    const updatedAt = new Date(res.updatedAt).getTime()
    const expired = updatedAt > now + this.ttl
    return {
      doc: res.doc,
      updatedAt,
      did,
      expired,
    }
    return null
  }

  async clear(): Promise<void> {
    await this.db.db.deleteFrom('did_cache').execute()
  }
}

export default DidSqlCache
