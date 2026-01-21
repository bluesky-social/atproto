import events from 'node:events'
import http from 'node:http'
import { connectNodeAdapter } from '@connectrpc/connect-node'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { ServerConfig } from './config'
import { AppContext, AppContextOptions } from './context'
import { createMuteOpChannel } from './db/schema/mute_op'
import { createNotifOpChannel } from './db/schema/notif_op'
import { createOperationChannel } from './db/schema/operation'
import { dbLogger, loggerMiddleware } from './logger'
import routes from './routes'

export * from './config'
export * from './client'
export { Database } from './db'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class BsyncService {
  public ctx: AppContext
  public server: http.Server
  private ac: AbortController
  private terminator: HttpTerminator
  private dbStatsInterval?: NodeJS.Timeout

  constructor(opts: {
    ctx: AppContext
    server: http.Server
    ac: AbortController
  }) {
    this.ctx = opts.ctx
    this.server = opts.server
    this.ac = opts.ac
    this.terminator = createHttpTerminator({ server: this.server })
  }

  static async create(
    cfg: ServerConfig,
    overrides?: Partial<AppContextOptions>,
  ): Promise<BsyncService> {
    const ac = new AbortController()
    const ctx = await AppContext.fromConfig(cfg, ac.signal, overrides)
    const handler = connectNodeAdapter({
      routes: routes(ctx),
      shutdownSignal: ac.signal,
    })
    const server = http.createServer((req, res) => {
      loggerMiddleware(req, res)
      if (isHealth(req.url)) {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        return res.end(JSON.stringify({ version: cfg.service.version }))
      }
      handler(req, res)
    })
    return new BsyncService({ ctx, server, ac })
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
    this.server.listen(this.ctx.cfg.service.port)
    this.server.keepAliveTimeout = 90000
    await events.once(this.server, 'listening')
    return this.server
  }

  async destroy(): Promise<void> {
    this.ac.abort()
    await this.terminator.terminate()
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
    conn.query(`listen ${createOperationChannel}`)
    conn.on('notification', (notif) => {
      if (notif.channel === createMuteOpChannel) {
        this.ctx.events.emit(createMuteOpChannel)
      }
      if (notif.channel === createNotifOpChannel) {
        this.ctx.events.emit(createNotifOpChannel)
      }
      if (notif.channel === createOperationChannel) {
        this.ctx.events.emit(createOperationChannel)
      }
    })
  }
}

export default BsyncService

const isHealth = (urlStr: string | undefined) => {
  if (!urlStr) return false
  const url = new URL(urlStr, 'http://host')
  return url.pathname === '/_health'
}
