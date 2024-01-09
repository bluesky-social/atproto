import http from 'node:http'
import events from 'node:events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import { connectNodeAdapter } from '@connectrpc/connect-node'
import { loggerMiddleware } from './logger'
import AppContext, { AppContextOptions } from './context'
import { ServerConfig } from './config'
import routes from './routes'

export * from './config'
export { Database } from './db'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class BsyncService {
  public ctx: AppContext
  public server: http.Server
  private ac: AbortController
  private terminator: HttpTerminator

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
    const ctx = await AppContext.fromConfig(cfg, overrides)
    const ac = new AbortController()
    const handler = connectNodeAdapter({
      routes: routes(ctx),
      shutdownSignal: ac.signal,
    })
    const server = http.createServer((req, res) => {
      loggerMiddleware(req, res)
      handler(req, res)
    })
    return new BsyncService({ ctx, server, ac })
  }

  async start(): Promise<http.Server> {
    // @TODO db stats
    this.server.listen(this.ctx.cfg.service.port)
    this.server.keepAliveTimeout = 90000
    await events.once(this.server, 'listening')
    return this.server
  }

  async destroy(): Promise<void> {
    this.ac.abort()
    await this.terminator.terminate()
    await this.ctx.db.close()
  }
}

export default BsyncService
