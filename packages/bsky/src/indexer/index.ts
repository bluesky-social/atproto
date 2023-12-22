import express from 'express'
import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import { PrimaryDatabase } from '../db'
import DidRedisCache from '../did-cache'
import log from './logger'
import { dbLogger } from '../logger'
import { IndexerConfig } from './config'
import { IndexerContext } from './context'
import { createServices } from './services'
import { IndexerSubscription } from './subscription'
import { AutoModerator } from '../auto-moderator'
import { Redis } from '../redis'
import { NotificationServer } from '../notifications'
import { CloseFn, createServer, startServer } from './server'

export { IndexerConfig } from './config'
export type { IndexerConfigValues } from './config'

export class BskyIndexer {
  public ctx: IndexerContext
  public sub: IndexerSubscription
  public app: express.Application
  private closeServer?: CloseFn
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: {
    ctx: IndexerContext
    sub: IndexerSubscription
    app: express.Application
  }) {
    this.ctx = opts.ctx
    this.sub = opts.sub
    this.app = opts.app
  }

  static create(opts: {
    db: PrimaryDatabase
    redis: Redis
    redisCache: Redis
    cfg: IndexerConfig
  }): BskyIndexer {
    const { db, redis, redisCache, cfg } = opts
    const didCache = new DidRedisCache(redisCache.withNamespace('did-doc'), {
      staleTTL: cfg.didCacheStaleTTL,
      maxTTL: cfg.didCacheMaxTTL,
    })
    const idResolver = new IdResolver({
      plcUrl: cfg.didPlcUrl,
      didCache,
      backupNameservers: cfg.handleResolveNameservers,
    })
    const backgroundQueue = new BackgroundQueue(db)

    const autoMod = new AutoModerator({
      db,
      idResolver,
      cfg,
      backgroundQueue,
    })

    const notifServer = cfg.pushNotificationEndpoint
      ? new NotificationServer(db, cfg.pushNotificationEndpoint)
      : undefined
    const services = createServices({
      idResolver,
      autoMod,
      backgroundQueue,
      notifServer,
    })
    const ctx = new IndexerContext({
      db,
      redis,
      redisCache,
      cfg,
      services,
      idResolver,
      didCache,
      backgroundQueue,
      autoMod,
    })
    const sub = new IndexerSubscription(ctx, {
      partitionIds: cfg.indexerPartitionIds,
      partitionBatchSize: cfg.indexerPartitionBatchSize,
      concurrency: cfg.indexerConcurrency,
      subLockId: cfg.indexerSubLockId,
    })

    const app = createServer(sub, cfg)

    return new BskyIndexer({ ctx, sub, app })
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
    this.closeServer = startServer(this.app, this.ctx.cfg.indexerPort)
    return this
  }

  async destroy(opts?: { skipDb: boolean; skipRedis: true }): Promise<void> {
    if (this.closeServer) await this.closeServer()
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    await this.ctx.didCache.destroy()
    if (!opts?.skipRedis) await this.ctx.redis.destroy()
    if (!opts?.skipRedis) await this.ctx.redisCache.destroy()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIndexer
