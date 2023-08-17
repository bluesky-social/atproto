import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { PrimaryDatabase } from '../db'
import DidSqlCache from '../did-cache'
import log from './logger'
import { dbLogger } from '../logger'
import { IndexerConfig } from './config'
import { IndexerContext } from './context'
import { createServices } from './services'
import { IndexerSubscription } from './subscription'
import { HiveLabeler, KeywordLabeler, Labeler } from '../labeler'
import { Redis } from '../redis'

export { IndexerConfig } from './config'
export type { IndexerConfigValues } from './config'

export class BskyIndexer {
  public ctx: IndexerContext
  public sub: IndexerSubscription
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: IndexerContext; sub: IndexerSubscription }) {
    this.ctx = opts.ctx
    this.sub = opts.sub
  }

  static create(opts: {
    db: PrimaryDatabase
    redis: Redis
    cfg: IndexerConfig
  }): BskyIndexer {
    const { db, redis, cfg } = opts
    const didCache = new DidSqlCache(
      db,
      cfg.didCacheStaleTTL,
      cfg.didCacheMaxTTL,
    )
    const idResolver = new IdResolver({
      plcUrl: cfg.didPlcUrl,
      didCache,
      backupNameservers: cfg.handleResolveNameservers,
    })
    const backgroundQueue = new BackgroundQueue(db)
    let labeler: Labeler
    if (cfg.hiveApiKey) {
      labeler = new HiveLabeler(cfg.hiveApiKey, {
        db,
        cfg,
        idResolver,
        backgroundQueue,
      })
    } else {
      labeler = new KeywordLabeler({
        db,
        cfg,
        idResolver,
        backgroundQueue,
      })
    }
    const services = createServices({ idResolver, labeler, backgroundQueue })
    const ctx = new IndexerContext({
      db,
      redis,
      cfg,
      services,
      idResolver,
      didCache,
      backgroundQueue,
    })
    const sub = new IndexerSubscription(ctx, {
      partitionIds: cfg.indexerPartitionIds,
      partitionBatchSize: cfg.indexerPartitionBatchSize,
      concurrency: cfg.indexerConcurrency,
      subLockId: cfg.indexerSubLockId,
    })
    return new BskyIndexer({ ctx, sub })
  }

  async start() {
    const { db, backgroundQueue } = this.ctx
    const pool = db.pool
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: pool.idleCount,
          totalCount: pool.totalCount,
          waitingCount: pool.waitingCount,
        },
        'db pool stats',
      )
      dbLogger.info(
        {
          runningCount: backgroundQueue.queue.pending,
          waitingCount: backgroundQueue.queue.size,
        },
        'background queue stats',
      )
    }, 10000)
    this.subStatsInterval = setInterval(() => {
      log.info(
        {
          processedCount: this.sub.processedCount,
          runningCount: this.sub.repoQueue.main.pending,
          waitingCount: this.sub.repoQueue.main.size,
        },
        'indexer stats',
      )
    }, 500)
    this.sub.run()
    return this
  }

  async destroy(opts?: { skipDb: boolean; skipRedis: true }): Promise<void> {
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    if (!opts?.skipRedis) await this.ctx.redis.destroy()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIndexer
