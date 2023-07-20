import Database from '../db'
import { dbLogger, subLogger } from '../logger'
import { IngesterConfig } from './config'
import AppContext, { IngesterContext } from './context'
import { IngesterSubscription } from './subscription'
import { Redis } from 'ioredis'

export class BskyIngester {
  public ctx: AppContext
  public sub: IngesterSubscription
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: AppContext; sub: IngesterSubscription }) {
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
    const sub = new IngesterSubscription(
      ctx,
      cfg.repoProvider,
      cfg.repoSubLockId,
    )
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

  async destroy(): Promise<void> {
    await this.sub.destroy()
    clearInterval(this.subStatsInterval)
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyIngester
