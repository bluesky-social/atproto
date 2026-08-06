// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import events, { once } from 'node:events'
import type http from 'node:http'
import { PlcClientError } from '@did-plc/lib'
import cors from 'cors'
import express from 'express'
import { type HttpTerminator, createHttpTerminator } from 'http-terminator'
import { DAY, SECOND } from '@atproto/common'
import {
  type MethodHandler,
  ResponseType,
  XRPCError,
  createServer,
} from '@atproto/xrpc-server'
import apiRoutes from './api/index.js'
import * as authRoutes from './auth-routes.js'
import * as basicRoutes from './basic-routes.js'
import {
  type ServerConfig,
  type ServerEnvironment,
  type ServerSecrets,
  envToCfg,
  envToSecrets,
  readEnv,
} from './config/index.js'
import { AppContext, type AppContextOptions } from './context.js'
import * as error from './error.js'
import type { app } from './lexicons.js'
import { loggerMiddleware, pdsLogger } from './logger.js'
import { proxyHandler } from './pipethrough.js'
import { buildRateLimitsConfig } from './rate-limits.js'
import compression from './util/compression.js'
import * as wellKnown from './well-known.js'

export {
  bearerTokenFromReq,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier.js'
export * from './config/index.js'
export { AppContext } from './context.js'
export { Database } from './db/index.js'
export { DiskBlobStore } from './disk-blobstore.js'
export * from './lexicons.js'
export { httpLogger } from './logger.js'
export { type CommitDataWithOps, type PreparedWrite } from './repo/index.js'
export * as repoPrepare from './repo/prepare.js'
export { scripts } from './scripts/index.js'
export * as sequencer from './sequencer/index.js'

/**
 * @deprecated Legacy export for backwards compatibility
 */
export type SkeletonHandler = MethodHandler<
  void,
  app.bsky.feed.getFeedSkeleton.$Params,
  void,
  app.bsky.feed.getFeedSkeleton.$Output
>

export class PDS implements AsyncDisposable {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async fromEnv(env: ServerEnvironment = readEnv()): Promise<PDS> {
    const cfg = envToCfg(env)
    const secrets = envToSecrets(env)
    return PDS.create(cfg, secrets)
  }

  /**
   * Creates and starts a PDS instance, and waits for a termination signal to
   * stop it.
   */
  static async run({
    env = undefined,
    signal: inputSignal,
    signals = ['SIGINT', 'SIGTERM'],
    onCreated = undefined,
    onStarted = undefined,
  }: {
    env?: ServerEnvironment
    signal?: AbortSignal
    signals?: readonly NodeJS.Signals[]
    /**
     * Hook that allows attaching additional logic (like adding custom HTTP
     * routes) before the PDS is started.
     */
    onCreated?: (pds: PDS) => void | Promise<void>
    onStarted?: (pds: PDS) => void | Promise<void>
  } = {}): Promise<void> {
    const ac = new AbortController()
    const { signal } = ac
    const abort = () => ac.abort()

    // Always abort the internal signal, ensuring proper resource cleanup
    using _ = { [Symbol.dispose]: abort }

    // Bind the internal signal to the input signal (will automatically remove
    // the listener when the internal signal is aborted)
    inputSignal?.throwIfAborted()
    inputSignal?.addEventListener('abort', abort, { signal })

    // Bind the internal signal to the process signals (will automatically
    // remove the listener when the internal signal is aborted)
    for (const sig of signals) {
      process.on(sig, abort)
      signal.addEventListener('abort', () => process.off(sig, abort))
    }

    await using pds = await PDS.fromEnv(env)

    if (signal.aborted) return

    await onCreated?.(pds)

    if (signal.aborted) return

    pdsLogger.info('starting')

    await pds.start()

    if (signal.aborted) return

    await onStarted?.(pds)

    if (signal.aborted) return

    pdsLogger.info('started')

    await once(signal, 'abort')

    pdsLogger.info('stopping')
  }

  static async create(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<PDS> {
    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    const { rateLimits } = ctx.cfg

    const server = createServer([], {
      validateResponse: cfg.service.devMode,
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
      rateLimits: buildRateLimitsConfig(rateLimits, ctx.redisScratch),
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
    app.use(compression())
    app.use(authRoutes.createRouter(ctx)) // Before CORS
    app.use(cors({ maxAge: DAY / SECOND }))
    app.use(basicRoutes.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.router)
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
    this.server.keepAliveTimeout = 90_000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    try {
      await this.terminator?.terminate()
    } finally {
      await this.ctx.destroy()
    }
  }

  async [Symbol.asyncDispose]() {
    await this.destroy()
  }
}

export default PDS

const getTrustedIps = (cfg: ServerConfig) => {
  if (!cfg.rateLimits.enabled) return []
  return cfg.rateLimits.bypassIps ?? []
}
