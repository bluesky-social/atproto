import express from 'express'
import compression from 'compression'
import http from 'node:http'
import events from 'node:events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import { dbLogger, loggerMiddleware } from './logger'
import AppContext, { AppContextOptions } from './context'
import { ServerConfig } from './config'
import routes from './routes'
import { createMuteOpChannel } from './db/schema/mute_op'
import { createNotifOpChannel } from './db/schema/notif_op'
import * as health from './api/health'
import * as revenueCat from './api/revenueCat'
import { expressConnectMiddleware } from '@connectrpc/connect-express'
import { createPurchaseOpChannel } from './db/schema/purchase_op'

export * from './config'
export * from './client'
export { Database } from './db'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class BsyncService {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private ac: AbortController
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timeout

  constructor(opts: {
    ctx: AppContext
    app: express.Application
    ac: AbortController
  }) {
    this.ctx = opts.ctx
    this.app = opts.app
    this.ac = opts.ac
  }

  static async create(
    cfg: ServerConfig,
    overrides?: Partial<AppContextOptions>,
  ): Promise<BsyncService> {
    const ac = new AbortController()
    const ctx = await AppContext.fromConfig(cfg, ac.signal, overrides)

    const app = express()
    app.use(loggerMiddleware)
    app.use(compression())

    app.use(
      expressConnectMiddleware({
        routes: routes(ctx),
        shutdownSignal: ac.signal,
      }),
    )

    app.use(health.createRouter(ctx))
    if (ctx.purchasesClient) {
      app.use('/webhooks/revenuecat', revenueCat.createRouter(ctx))
    }

    return new BsyncService({ ctx, app, ac })
  }

  async start(): Promise<http.Server> {
    if (this.dbStatsInterval) {
      throw new Error(`${this.constructor.name} already started`)
    }
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: this.ctx.db.pool.idleCount,
          totalCount: this.ctx.db.pool.totalCount,
          waitingCount: this.ctx.db.pool.waitingCount,
        },
        'db pool stats',
      )
    }, 10000)
    await this.setupAppEvents()

    const server = this.app.listen(this.ctx.cfg.service.port)
    server.keepAliveTimeout = 90000
    this.server = server
    this.terminator = createHttpTerminator({ server: this.server })
    await events.once(this.server, 'listening')
    return this.server
  }

  async destroy(): Promise<void> {
    this.ac.abort()
    await this.terminator?.terminate()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
    this.dbStatsInterval = undefined
  }

  async setupAppEvents() {
    const conn = await this.ctx.db.pool.connect()
    this.ac.signal.addEventListener('abort', () => conn.release(), {
      once: true,
    })
    // if these error, unhandled rejection should cause process to exit
    conn.query(`listen ${createMuteOpChannel}`)
    conn.query(`listen ${createNotifOpChannel}`)
    conn.query(`listen ${createPurchaseOpChannel}`)
    conn.on('notification', (notif) => {
      if (notif.channel === createMuteOpChannel) {
        this.ctx.events.emit(createMuteOpChannel)
      }
      if (notif.channel === createNotifOpChannel) {
        this.ctx.events.emit(createNotifOpChannel)
      }
      if (notif.channel === createPurchaseOpChannel) {
        this.ctx.events.emit(createPurchaseOpChannel)
      }
    })
  }
}

export default BsyncService
