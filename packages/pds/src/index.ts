// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import events from 'node:events'
import http from 'node:http'
import { PlcClientError } from '@did-plc/lib'
import cors from 'cors'
import express from 'express'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { DAY, HOUR, MINUTE, SECOND } from '@atproto/common'
import {
  MemoryRateLimiter,
  MethodHandler,
  RedisRateLimiter,
  ResponseType,
  XRPCError,
} from '@atproto/xrpc-server'
import apiRoutes from './api'
import * as authRoutes from './auth-routes'
import * as basicRoutes from './basic-routes'
import { ServerConfig, ServerSecrets } from './config'
import { AppContext, AppContextOptions } from './context'
import * as error from './error'
import { createServer } from './lexicon'
import * as AppBskyFeedGetFeedSkeleton from './lexicon/types/app/bsky/feed/getFeedSkeleton'
import { loggerMiddleware } from './logger'
import { proxyHandler } from './pipethrough'
import { metricsMiddleware } from './metrics'
import compression from './util/compression'
import * as wellKnown from './well-known'

export { createSecretKeyObject } from './auth-verifier'
export * from './config'
export { AppContext } from './context'
export { Database } from './db'
export { DiskBlobStore } from './disk-blobstore'
export { createServer as createLexiconServer } from './lexicon'
export { httpLogger } from './logger'
export { type CommitDataWithOps, type PreparedWrite } from './repo'
export * as repoPrepare from './repo/prepare'
export { scripts } from './scripts'
export * as sequencer from './sequencer'

// Legacy export for backwards compatibility
export type SkeletonHandler = MethodHandler<
  void,
  AppBskyFeedGetFeedSkeleton.QueryParams,
  AppBskyFeedGetFeedSkeleton.HandlerInput,
  AppBskyFeedGetFeedSkeleton.HandlerOutput
>

export class PDS {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timeout
  private sequencerStatsInterval?: NodeJS.Timeout

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async create(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<PDS> {
    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    const { rateLimits } = ctx.cfg

    const server = createServer({
      validateResponse: false,
      payload: {
        jsonLimit: 150 * 1024, // 150kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: cfg.service.blobUploadLimit,
      },
      catchall: proxyHandler(ctx),
      errorParser: (err) => {
        if (err instanceof PlcClientError) {
          const payloadMessage =
            typeof err.data === 'object' &&
            err.data != null &&
            'message' in err.data &&
            typeof err.data.message === 'string' &&
            err.data.message

          const type =
            err.status >= 500
              ? ResponseType.UpstreamFailure
              : ResponseType.InvalidRequest

          return new XRPCError(
            type,
            payloadMessage || 'Unable to perform PLC operation',
          )
        }

        return XRPCError.fromError(err)
      },
      rateLimits: rateLimits.enabled
        ? {
            creator: ctx.redisScratch
              ? (opts) => new RedisRateLimiter(ctx.redisScratch, opts)
              : (opts) => new MemoryRateLimiter(opts),
            bypass: ({ req }) => {
              const { bypassKey, bypassIps } = rateLimits
              if (
                bypassKey &&
                bypassKey === req.headers['x-ratelimit-bypass']
              ) {
                return true
              }
              if (bypassIps && bypassIps.includes(req.ip)) {
                return true
              }
              return false
            },
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
        : undefined,
    })

    apiRoutes(server, ctx)

    const app = express()
    app.set('trust proxy', [
      // e.g. load balancer
      'loopback',
      'linklocal',
      'uniquelocal',
      // e.g. trust x-forwarded-for via entryway ip
      ...getTrustedIps(cfg),
    ])
    app.use(loggerMiddleware)
    app.use(metricsMiddleware())
    app.use(compression())
    app.use(authRoutes.createRouter(ctx)) // Before CORS
    app.use(cors({ maxAge: DAY / SECOND }))
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
    await this.ctx.sequencer.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    this.server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    await this.ctx.sequencer.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.accountManager.close()
    await this.ctx.redisScratch?.quit()
    await this.ctx.proxyAgent.destroy()
    clearInterval(this.dbStatsInterval)
    clearInterval(this.sequencerStatsInterval)
  }
}

export default PDS

const getTrustedIps = (cfg: ServerConfig) => {
  if (!cfg.rateLimits.enabled) return []
  return cfg.rateLimits.bypassIps ?? []
}
