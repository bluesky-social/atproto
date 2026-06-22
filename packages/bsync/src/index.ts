import events from 'node:events'
import http from 'node:http'
import { connectNodeAdapter } from '@connectrpc/connect-node'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { ServerConfig } from './config.js'
import { AppContext, AppContextOptions } from './context.js'
import { createMuteOpChannel } from './db/schema/mute_op.js'
import { createNotifOpChannel } from './db/schema/notif_op.js'
import { createOperationChannel } from './db/schema/operation.js'
import { dbLogger, loggerMiddleware } from './logger.js'
import routes from './routes/index.js'

export * from './config.js'
export * from './client.js'
export { Database } from './db/index.js'
export { AppContext } from './context.js'
export { httpLogger } from './logger.js'

type BsyncServiceState = 'initialized' | 'started' | 'destroyed'

export class BsyncService {
  public ctx: AppContext
  public server: http.Server
  private terminator: httpTerminator.HttpTerminator
  private ac: AbortController
  private state: BsyncServiceState = 'initialized'

  constructor(opts: {
    ctx: AppContext
    server: http.Server
    ac: AbortController
  }) {
    this.ctx = opts.ctx
    this.server = opts.server
    this.ac = opts.ac
    this.terminator = httpTerminator.createHttpTerminator(opts)
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
    if (this.state !== 'initialized') {
      throw new Error(`${this.constructor.name} already started`)
    }
    this.state = 'started'

    const dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: this.ctx.db.pool.idleCount,
          totalCount: this.ctx.db.pool.totalCount,
          waitingCount: this.ctx.db.pool.waitingCount,
        },
        'db pool stats',
      )
    }, 10000)

    this.ac.signal.addEventListener('abort', () => {
      clearInterval(dbStatsInterval)
    })

    await this.setupAppEvents()
    this.server.listen(this.ctx.cfg.service.port)
    this.server.keepAliveTimeout = 90000
    await events.once(this.server, 'listening')
    return this.server
  }

  async destroy(): Promise<void> {
    if (this.state === 'destroyed') return
    this.state = 'destroyed'
    this.ac.abort()
    try {
      await this.terminator.terminate()
    } finally {
      await this.ctx.db.close()
    }
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
