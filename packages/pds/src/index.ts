// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import events from 'events'
import {
  RateLimiter,
  RateLimiterCreator,
  RateLimiterOpts,
  Options as XrpcServerOptions,
} from '@atproto/xrpc-server'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import API from './api'
import * as basicRoutes from './basic-routes'
import * as wellKnown from './well-known'
import * as error from './error'
import { dbLogger, loggerMiddleware, seqLogger } from './logger'
import { ServerConfig, ServerSecrets } from './config'
import { createServer } from './lexicon'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext, { AppContextOptions } from './context'
import compression from './util/compression'

export * from './config'
export { Database } from './db'
export { PeriodicModerationActionReversal } from './db/periodic-moderation-action-reversal'
export { DiskBlobStore, MemoryBlobStore } from './storage'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class PDS {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timer
  private sequencerStatsInterval?: NodeJS.Timer

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async create(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<PDS> {
    const app = express()
    app.set('trust proxy', true)
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    const xrpcOpts: XrpcServerOptions = {
      validateResponse: false,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    }
    if (cfg.rateLimits.enabled) {
      const bypassSecret = cfg.rateLimits.bypassKey
      const bypassIps = cfg.rateLimits.bypassIps
      let rlCreator: RateLimiterCreator
      if (cfg.rateLimits.mode === 'redis') {
        if (!ctx.redisScratch) {
          throw new Error('Redis not set up for ratelimiting mode: `redis`')
        }
        rlCreator = (opts: RateLimiterOpts) =>
          RateLimiter.redis(ctx.redisScratch, {
            bypassSecret,
            bypassIps,
            ...opts,
          })
      } else {
        rlCreator = (opts: RateLimiterOpts) =>
          RateLimiter.memory({
            bypassSecret,
            bypassIps,
            ...opts,
          })
      }
      xrpcOpts['rateLimits'] = {
        creator: rlCreator,
        global: [
          {
            name: 'global-ip',
            durationMs: 5 * MINUTE,
            points: 3000,
          },
        ],
        shared: [
          {
            name: 'repo-write-hour',
            durationMs: HOUR,
            points: 5000, // creates=3, puts=2, deletes=1
          },
          {
            name: 'repo-write-day',
            durationMs: DAY,
            points: 35000, // creates=3, puts=2, deletes=1
          },
        ],
      }
    }

    let server = createServer(xrpcOpts)

    server = API(server, ctx)

    app.use(basicRoutes.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new PDS({
      ctx,
      app,
    })
  }

  async start(): Promise<http.Server> {
    const { db, backgroundQueue } = this.ctx
    if (db.cfg.dialect === 'pg') {
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
        dbLogger.info(
          {
            runningCount: backgroundQueue.queue.pending,
            waitingCount: backgroundQueue.queue.size,
          },
          'background queue stats',
        )
      }, 10000)
    }
    this.sequencerStatsInterval = setInterval(async () => {
      if (this.ctx.sequencerLeader?.isLeader) {
        try {
          const seq = await this.ctx.sequencerLeader.lastSeq()
          seqLogger.info({ seq }, 'sequencer leader stats')
        } catch (err) {
          seqLogger.error({ err }, 'error getting last seq')
        }
      }
    }, 500)
    this.ctx.sequencerLeader?.run()
    await this.ctx.sequencer.start()
    await this.ctx.db.startListeningToChannels()
    await this.ctx.runtimeFlags.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    this.server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    await this.ctx.runtimeFlags.destroy()
    await this.ctx.sequencerLeader?.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.db.close()
    await this.ctx.redisScratch?.quit()
    clearInterval(this.dbStatsInterval)
    clearInterval(this.sequencerStatsInterval)
  }
}

export default PDS
