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
  Options as XrpcServerOptions,
  ResponseType,
  XRPCError,
} from '@atproto/xrpc-server'
import API from './api'
import * as authRoutes from './auth-routes'
import * as basicRoutes from './basic-routes'
import { ServerConfig, ServerSecrets } from './config'
import { AppContext, AppContextOptions } from './context'
import * as error from './error'
import { createServer } from './lexicon'
import { loggerMiddleware } from './logger'
import { proxyHandler } from './pipethrough'
import compression from './util/compression'
import * as wellKnown from './well-known'

export * from './config'
export { Database } from './db'
export { DiskBlobStore } from './disk-blobstore'
export { AppContext } from './context'
export { httpLogger } from './logger'
export { createSecretKeyObject } from './auth-verifier'
export { type Handler as SkeletonHandler } from './lexicon/types/app/bsky/feed/getFeedSkeleton'
export { createServer as createLexiconServer } from './lexicon'
export * as sequencer from './sequencer'
export { type PreparedWrite } from './repo'
export * as repoPrepare from './repo/prepare'
export { scripts } from './scripts'

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

    const xrpcOpts: XrpcServerOptions = {
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
      rateLimits: ctx.ratelimitCreator
        ? {
            creator: ctx.ratelimitCreator,
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
    }

    let server = createServer(xrpcOpts)

    server = API(server, ctx)

    const app = express()
    app.set('trust proxy', true)
    app.use(loggerMiddleware)
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
