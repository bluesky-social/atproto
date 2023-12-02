import { PrimaryDatabase } from '../db'
import { dbLogger } from '../logger'
import { DaemonConfig } from './config'
import { DaemonContext } from './context'
import { createServices } from './services'
import { ImageUriBuilder } from '../image/uri'
import { LabelCache } from '../label-cache'
import { NotificationsDaemon } from './notifications'
import logger from './logger'

export { DaemonConfig } from './config'
export type { DaemonConfigValues } from './config'

export class BskyDaemon {
  public ctx: DaemonContext
  public notifications: NotificationsDaemon
  private dbStatsInterval: NodeJS.Timer
  private notifStatsInterval: NodeJS.Timer

  constructor(opts: {
    ctx: DaemonContext
    notifications: NotificationsDaemon
  }) {
    this.ctx = opts.ctx
    this.notifications = opts.notifications
  }

  static create(opts: { db: PrimaryDatabase; cfg: DaemonConfig }): BskyDaemon {
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
    this.notifStatsInterval = setInterval(() => {
      logger.info(
        {
          count: this.notifications.count,
          lastDid: this.notifications.lastDid,
        },
        'notifications daemon stats',
      )
    }, 10000)
    return this
  }

  async destroy(): Promise<void> {
    await this.notifications.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
    clearInterval(this.notifStatsInterval)
  }
}

export default BskyDaemon
