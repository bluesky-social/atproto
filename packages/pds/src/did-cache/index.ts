import PQueue from 'p-queue'
import { CacheResult, DidCache, DidDocument } from '@atproto/identity'
import { excluded } from '../db/util'
import { didCacheLogger } from '../logger'
import { DidCacheDb, getMigrator, getDb } from './db'

export class DidSqliteCache implements DidCache {
  db: DidCacheDb | null
  public pQueue: PQueue | null //null during teardown

  constructor(
    private dbLocation: string,
    public staleTTL: number,
    public maxTTL: number,
    private disableWalAutoCheckpoint = false,
  ) {
    this.db = null
    this.pQueue = new PQueue()
  }

  private async getDb(): Promise<DidCacheDb> {
    // If the db is set, return it, otherwise set it and return it.
    return this.db ? this.db : this.db = await getDb(this.dbLocation, this.disableWalAutoCheckpoint)
  }

  async cacheDid(
    did: string,
    doc: DidDocument,
    prevResult?: CacheResult,
  ): Promise<void> {
    try {
      const connection = await this.getDb();

      if (prevResult) {
        await connection.executeWithRetry(
          connection.db
            .updateTable('did_doc')
            .set({ doc: JSON.stringify(doc), updatedAt: Date.now() })
            .where('did', '=', did)
            .where('updatedAt', '=', prevResult.updatedAt),
        )
      } else {
        await connection.executeWithRetry(
          connection.db
            .insertInto('did_doc')
            .values({ did, doc: JSON.stringify(doc), updatedAt: Date.now() })
            .onConflict((oc) =>
              oc.column('did').doUpdateSet({
                doc: excluded(connection.db, 'doc'),
                updatedAt: excluded(connection.db, 'updatedAt'),
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
    const connection = await this.getDb();
    const res = await connection.db
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
      const connection = await this.getDb();
      await connection.executeWithRetry(
        connection.db.deleteFrom('did_doc').where('did', '=', did),
      )
    } catch (err) {
      didCacheLogger.error({ did, err }, 'clearing did cache entry failed')
    }
  }

  async clear(): Promise<void> {
    const connection = await this.getDb();
    await connection.db.deleteFrom('did_doc').execute()
  }

  async processAll() {
    await this.pQueue?.onIdle()
  }

  async migrateOrThrow() {
    const connection = await this.getDb()
    await connection.ensureWal()
    await getMigrator(connection).migrateToLatestOrThrow()
  }

  async destroy() {
    const pQueue = this.pQueue
    this.pQueue = null
    pQueue?.pause()
    pQueue?.clear()
    await pQueue?.onIdle()
  }
}
