import { Redis } from 'ioredis'
import Database from '../db'
import { dbLogger, subLogger } from '../logger'
import { IngesterConfig } from './config'
import { IngesterContext } from './context'
import { IngesterSubscription } from './subscription'

export { IngesterConfig } from './config'

export class BskyIngester {
  public ctx: IngesterContext
  public sub: IngesterSubscription
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: IngesterContext; sub: IngesterSubscription }) {
    this.ctx = opts.ctx
    this.sub = opts.sub
  }

  static create(opts: {
    db: Database
    redis: Redis
    cfg: IngesterConfig
  }): BskyIngester {
    const { db, redis, cfg } = opts
    const ctx = new IngesterContext({ db, redis, cfg })
    const sub = new IngesterSubscription(ctx, {
      service: cfg.repoProvider,
      namespace: cfg.ingesterNamespace,
      subLockId: cfg.ingesterSubLockId,
      partitionCount: cfg.ingesterPartitionCount,
      maxItems: cfg.ingesterMaxItems,
      checkItemsEveryN: cfg.ingesterCheckItemsEveryN,
    })
    return new BskyIngester({ ctx, sub })
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
      subLogger.info(
        {
          seq: this.sub?.lastSeq,
          cursor: this.sub?.lastCursor,
        },
        'ingester subscription stats',
      )
    }, 500)
    this.sub.run()
    return this
  }

  async destroy(opts?: { skipDb: boolean }): Promise<void> {
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    await this.ctx.redis.quit()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIngester
