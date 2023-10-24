import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { excluded } from '../db/util'
import { didCacheLogger } from '../logger'
import { DidCacheDb, getMigrator } from './db'
import { Database } from '../db'

export class DidSqliteCache implements DidCache {
  db: DidCacheDb
  public pQueue: PQueue | null //null during teardown

  constructor(
    dbLocation: string,
    public staleTTL: number,
    public maxTTL: number,
  ) {
    this.db = Database.sqlite(dbLocation)
    this.pQueue = new PQueue()
  }

  async cacheDid(did: string, doc: DidDocument): Promise<void> {
    try {
      await this.db.db
        .insertInto('did_doc')
        .values({ did, doc: JSON.stringify(doc), updatedAt: Date.now() })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({
            doc: excluded(this.db.db, 'doc'),
            updatedAt: Date.now(),
          }),
        )
        .executeTakeFirst()
    } catch (err) {
      didCacheLogger.error({ did, doc, err }, 'failed to cache did')
    }
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
        didCacheLogger.error({ did, err }, 'refreshing did cache failed')
      }
    })
  }

  async checkCache(did: string): Promise<CacheResult | null> {
    try {
      return await this.checkCacheInternal(did)
    } catch (err) {
      didCacheLogger.error({ did, err }, 'failed to check did cache')
      return null
    }
  }

  async checkCacheInternal(did: string): Promise<CacheResult | null> {
    const res = await this.db.db
      .selectFrom('did_doc')
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
      doc: JSON.parse(res.doc) as DidDocument,
      updatedAt,
      did,
      stale,
    }
  }

  async clearEntry(did: string): Promise<void> {
    try {
      await this.db.db
        .deleteFrom('did_doc')
        .where('did', '=', did)
        .executeTakeFirst()
    } catch (err) {
      didCacheLogger.error({ did, err }, 'clearing did cache entry failed')
    }
  }

  async clear(): Promise<void> {
    await this.db.db.deleteFrom('did_doc').execute()
  }

  async processAll() {
    await this.pQueue?.onIdle()
  }

  async migrateOrThrow() {
    await getMigrator(this.db).migrateToLatestOrThrow()
  }

  async destroy() {
    const pQueue = this.pQueue
    this.pQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
  }
}
