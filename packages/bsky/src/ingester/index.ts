import { PrimaryDatabase } from '../db'
import log from './logger'
import { dbLogger } from '../logger'
import { Redis } from '../redis'
import { IngesterConfig } from './config'
import { IngesterContext } from './context'
import { IngesterSubscription } from './subscription'

export { IngesterConfig } from './config'
export type { IngesterConfigValues } from './config'

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
    db: PrimaryDatabase
    redis: Redis
    cfg: IngesterConfig
  }): BskyIngester {
    const { db, redis, cfg } = opts
    const ctx = new IngesterContext({ db, redis, cfg })
    const sub = new IngesterSubscription(ctx, {
      service: cfg.repoProvider,
      subLockId: cfg.ingesterSubLockId,
      partitionCount: cfg.ingesterPartitionCount,
      maxItems: cfg.ingesterMaxItems,
      checkItemsEveryN: cfg.ingesterCheckItemsEveryN,
      initialCursor: cfg.ingesterInitialCursor,
    })
    return new BskyIngester({ ctx, sub })
  }

  async start() {
    const { db } = this.ctx
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
    }, 10000)
    this.subStatsInterval = setInterval(() => {
      log.info(
        {
          seq: this.sub.lastSeq,
          streamsLength:
            this.sub.backpressure.lastTotal !== null
              ? this.sub.backpressure.lastTotal
              : undefined,
        },
        'ingester stats',
      )
    }, 500)
    this.sub.run()
    return this
  }

  async destroy(opts?: { skipDb: boolean }): Promise<void> {
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    await this.ctx.redis.destroy()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIngester
