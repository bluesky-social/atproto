import { IdResolver } from '@atproto/identity'
import { BackgroundQueue } from '../background'
import Database from '../db'
import DidSqlCache from '../did-cache'
import { dbLogger } from '../logger'
import { IndexerConfig } from './config'
import AppContext, { IndexerContext } from './context'
import { createServices } from './services'
import { IndexerSubscription } from './subscription'
import { Redis } from 'ioredis'
import { HiveLabeler, KeywordLabeler, Labeler } from '../labeler'

export class BskyIndexer {
  public ctx: AppContext
  public sub: IndexerSubscription
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: AppContext; sub: IndexerSubscription }) {
    this.ctx = opts.ctx
    this.sub = opts.sub
  }

  static create(opts: {
    db: Database
    redis: Redis
    cfg: IndexerConfig
  }): BskyIndexer {
    const { db, redis, cfg } = opts
    const didCache = new DidSqlCache(
      db,
      cfg.didCacheStaleTTL,
      cfg.didCacheMaxTTL,
    )
    const idResolver = new IdResolver({ plcUrl: cfg.didPlcUrl, didCache })
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
    const ctx = new IndexerContext({ db, redis, cfg, services })
    const sub = new IndexerSubscription(
      ctx,
      cfg.indexerPartitionNames,
      cfg.indexerSubLockId,
      cfg.indexerConcurrency,
    )
    return new BskyIndexer({ ctx, sub })
  }

  async start() {
    const { db } = this.ctx
    const { pool } = db.cfg
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: pool.idleCount,
          totalCount: pool.totalCount,
          waitingCount: pool.waitingCount,
        },
        'db pool stats',
      )
    }, 10000)
    this.subStatsInterval = setInterval(() => {
      // @TODO stats per partition?
      // subLogger.info({}, 'indexer subscription stats')
    }, 500)
    this.sub.run()
    return this
  }

  async destroy(): Promise<void> {
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIndexer
