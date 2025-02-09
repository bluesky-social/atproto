import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { excluded } from '../db/util'
import { didCacheLogger } from '../logger'
import { DidCacheDb, getDb, getMigrator } from './db'

export class DidSqliteCache implements DidCache {
  db: DidCacheDb
  public pQueue: PQueue | null //null during teardown

  constructor(
    dbLocation: string,
    public staleTTL: number,
    public maxTTL: number,
    disableWalAutoCheckpoint = false,
  ) {
    this.db = getDb(dbLocation, disableWalAutoCheckpoint)
    this.pQueue = new PQueue()
  }

  async cacheDid(
    did: string,
    doc: DidDocument,
    prevResult?: CacheResult,
  ): Promise<void> {
    try {
      if (prevResult) {
        await this.db.executeWithRetry(
          this.db.db
            .updateTable('did_doc')
            .set({ doc: JSON.stringify(doc), updatedAt: Date.now() })
            .where('did', '=', did)
            .where('updatedAt', '=', prevResult.updatedAt),
        )
      } else {
        await this.db.executeWithRetry(
          this.db.db
            .insertInto('did_doc')
            .values({ did, doc: JSON.stringify(doc), updatedAt: Date.now() })
            .onConflict((oc) =>
              oc.column('did').doUpdateSet({
                doc: excluded(this.db.db, 'doc'),
                updatedAt: excluded(this.db.db, 'updatedAt'),
              }),
            ),
        )
      }
    } catch (err) {
      didCacheLogger.error({ did, doc, err }, 'failed to cache did')
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
    const stale = now > updatedAt + this.staleTTL
    return {
      doc: JSON.parse(res.doc) as DidDocument,
      updatedAt,
      did,
      stale,
      expired,
    }
  }

  async clearEntry(did: string): Promise<void> {
    try {
      await this.db.executeWithRetry(
        this.db.db.deleteFrom('did_doc').where('did', '=', did),
      )
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
    await this.db.ensureWal()
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
