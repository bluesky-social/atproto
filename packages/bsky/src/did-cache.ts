import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { PrimaryDatabase } from './db'
import { dbLogger } from './logger'

export class DidSqlCache implements DidCache {
  public pQueue: PQueue | null //null during teardown

  constructor(
    // @TODO perhaps could use both primary and non-primary. not high enough
    // throughput to matter right now. also may just move this over to redis before long!
    public db: PrimaryDatabase,
    public staleTTL: number,
    public maxTTL: number,
  ) {
    this.pQueue = new PQueue()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    await this.db.db
      .insertInto('did_cache')
      .values({ did, doc, updatedAt: Date.now() })
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({ doc, updatedAt: Date.now() }),
      )
      .executeTakeFirst()
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
  ): Promise<void> {
    this.pQueue?.add(async () => {
      try {
        const doc = await getDoc()
        if (doc) {
          await this.cacheDid(did, doc)
        } else {
          await this.clearEntry(did)
        }
      } catch (err) {
        dbLogger.error({ did, err }, 'refreshing did cache failed')
      }
    })
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

    const expired = now > updatedAt + this.maxTTL
    if (expired) {
      return null
    }

    const stale = now > updatedAt + this.staleTTL
    return {
      doc: res.doc,
      updatedAt,
      did,
      stale,
    }
  }

  async clearEntry(did: string): Promise<void> {
    await this.db.db
      .deleteFrom('did_cache')
      .where('did', '=', did)
      .executeTakeFirst()
  }

  async clear(): Promise<void> {
    await this.db.db.deleteFrom('did_cache').execute()
  }

  async processAll() {
    await this.pQueue?.onIdle()
  }

  async destroy() {
    const pQueue = this.pQueue
    this.pQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
  }
}

export default DidSqlCache
