import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { PrimaryDatabase } from './db'
import { excluded } from './db/util'
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

  async cacheDid(
    did: string,
    doc: DidDocument,
    prevResult?: CacheResult,
  ): Promise<void> {
    if (prevResult) {
      await this.db.db
        .updateTable('did_cache')
        .set({ doc, updatedAt: Date.now() })
        .where('did', '=', did)
        .where('updatedAt', '=', prevResult.updatedAt)
        .execute()
    } else {
      await this.db.db
        .insertInto('did_cache')
        .values({ did, doc, updatedAt: Date.now() })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({
            doc: excluded(this.db.db, 'doc'),
            updatedAt: excluded(this.db.db, 'updatedAt'),
          }),
        )
        .executeTakeFirst()
    }
  }

  async refreshCache(
    did: string,
    getDoc: () => Promise<DidDocument | null>,
    prevResult?: CacheResult,
  ): Promise<void> {
    this.pQueue?.add(async () => {
      try {
        const doc = await getDoc()
        if (doc) {
          await this.cacheDid(did, doc, prevResult)
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
    const stale = now > updatedAt + this.staleTTL
    return {
      doc: res.doc,
      updatedAt,
      did,
      stale,
      expired,
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
