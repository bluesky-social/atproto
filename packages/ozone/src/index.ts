import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import API, { health, wellKnown } from './api'
import * as error from './error'
import { dbLogger, loggerMiddleware } from './logger'
import { OzoneConfig, OzoneSecrets } from './config'
import { createServer } from './lexicon'
import AppContext, { AppContextOptions } from './context'

export * from './config'
export { type ImageInvalidator } from './image-invalidator'
export { Database } from './db'
export { OzoneDaemon, EventPusher, EventReverser } from './daemon'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class OzoneService {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async create(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<OzoneService> {
    const app = express()
    app.set('trust proxy', true)
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    let server = createServer({
      validateResponse: false,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new OzoneService({ ctx, app })
  }

  async start(): Promise<http.Server> {
    const { db, backgroundQueue } = this.ctx
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: db.pool.idleCount,
          totalCount: db.pool.totalCount,
          waitingCount: db.pool.waitingCount,
        },
        'db pool stats',
      )
      dbLogger.info(
        {
          runningCount: backgroundQueue.queue.pending,
          waitingCount: backgroundQueue.queue.size,
        },
        'background queue stats',
      )
    }, 10000)
    await this.ctx.sequencer.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.assignPort(port)
    return server
  }

  async destroy(): Promise<void> {
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.sequencer.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default OzoneService
