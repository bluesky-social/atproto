import { PrimaryDatabase } from '../db'
import { dbLogger } from '../logger'
import { DaemonConfig } from './config'
import { DaemonContext } from './context'
import { createServices } from './services'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { LabelCache } from '../label-cache'
import { NotificationsDaemon } from './notifications'

export { DaemonConfig } from './config'
export type { DaemonConfigValues } from './config'

export class BskyDaemon {
  public ctx: DaemonContext
  public notifications: NotificationsDaemon
  private dbStatsInterval: NodeJS.Timer

  constructor(opts: {
    ctx: DaemonContext
    notifications: NotificationsDaemon
  }) {
    this.ctx = opts.ctx
    this.notifications = opts.notifications
  }

  static create(opts: {
    db: PrimaryDatabase
    cfg: DaemonConfig
    imgInvalidator?: ImageInvalidator
  }): BskyDaemon {
    const { db, cfg } = opts
    const imgUriBuilder = new ImageUriBuilder('https://daemon.invalid') // will not be used by daemon
    const labelCache = new LabelCache(db)
    const services = createServices({
      imgUriBuilder,
      labelCache,
    })
    const ctx = new DaemonContext({
      db,
      cfg,
      services,
    })
    const notifications = new NotificationsDaemon(ctx)
    return new BskyDaemon({ ctx, notifications })
  }

  async start() {
    const { db } = this.ctx
    const pool = db.pool
    this.notifications.run()
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
    return this
  }

  async destroy(): Promise<void> {
    await this.notifications.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyDaemon
