import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import { IdResolver } from '@atproto/identity'
import {
  RateLimiter,
  RateLimiterOpts,
  Options as XrpcServerOptions,
} from '@atproto/xrpc-server'
import { MINUTE } from '@atproto/common'
import API, { health, wellKnown, blobResolver } from './api'
import { DatabaseCoordinator } from './db'
import * as error from './error'
import { dbLogger, loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import AppContext from './context'
import DidRedisCache from './did-cache'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { BackgroundQueue } from './background'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { Redis } from './redis'
import { AuthVerifier } from './auth-verifier'
import { authWithApiKey as bsyncAuth, createBsyncClient } from './bsync'
import { authWithApiKey as courierAuth, createCourierClient } from './courier'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database, PrimaryDatabase, DatabaseCoordinator } from './db'
export { Redis } from './redis'
export { ViewMaintainer } from './db/views'
export { AppContext } from './context'
export type { ImageInvalidator } from './image/invalidator'
export * from './daemon'
export * from './indexer'
export * from './ingester'

export class BskyAppView {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval: NodeJS.Timer

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: DatabaseCoordinator
    redis: Redis
    config: ServerConfig
    signingKey: Keypair
    imgInvalidator?: ImageInvalidator
  }): BskyAppView {
    const { db, redis, config, signingKey } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const app = express()
    app.set('trust proxy', true)
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

    const didCache = new DidRedisCache(redis.withNamespace('did-doc'), {
      staleTTL: config.didCacheStaleTTL,
      maxTTL: config.didCacheMaxTTL,
    })

    const idResolver = new IdResolver({
      plcUrl: config.didPlcUrl,
      didCache,
      backupNameservers: config.handleResolveNameservers,
    })

    const imgUriBuilder = new ImageUriBuilder(
      config.imgUriEndpoint || `${config.publicUrl}/img`,
    )

    let imgProcessingServer: ImageProcessingServer | undefined
    if (!config.imgUriEndpoint) {
      const imgProcessingCache = new BlobDiskCache(config.blobCacheLocation)
      imgProcessingServer = new ImageProcessingServer(
        config,
        imgProcessingCache,
      )
      maybeImgInvalidator ??= new ImageProcessingServerInvalidator(
        imgProcessingCache,
      )
    }

    let imgInvalidator: ImageInvalidator
    if (maybeImgInvalidator) {
      imgInvalidator = maybeImgInvalidator
    } else {
      throw new Error('Missing appview image invalidator')
    }

    const backgroundQueue = new BackgroundQueue(db.getPrimary())

    const searchAgent = config.searchEndpoint
      ? new AtpAgent({ service: config.searchEndpoint })
      : undefined

    const services = createServices({
      imgUriBuilder,
      imgInvalidator,
      labelCacheOpts: {
        redis: redis.withNamespace('label'),
        staleTTL: config.labelCacheStaleTTL,
        maxTTL: config.labelCacheMaxTTL,
      },
    })

    const authVerifier = new AuthVerifier(idResolver, {
      ownDid: config.serverDid,
      adminDid: config.modServiceDid,
      adminPass: config.adminPassword,
      moderatorPass: config.moderatorPassword,
      triagePass: config.triagePassword,
    })

    const bsyncClient = config.bsyncUrl
      ? createBsyncClient({
          baseUrl: config.bsyncUrl,
          httpVersion: config.bsyncHttpVersion ?? '2',
          nodeOptions: { rejectUnauthorized: !config.bsyncIgnoreBadTls },
          interceptors: config.bsyncApiKey
            ? [bsyncAuth(config.bsyncApiKey)]
            : [],
        })
      : undefined

    const courierClient = config.courierUrl
      ? createCourierClient({
          baseUrl: config.courierUrl,
          httpVersion: config.courierHttpVersion ?? '2',
          nodeOptions: { rejectUnauthorized: !config.courierIgnoreBadTls },
          interceptors: config.courierApiKey
            ? [courierAuth(config.courierApiKey)]
            : [],
        })
      : undefined

    const ctx = new AppContext({
      db,
      cfg: config,
      services,
      imgUriBuilder,
      signingKey,
      idResolver,
      didCache,
      redis,
      backgroundQueue,
      searchAgent,
      bsyncClient,
      courierClient,
      authVerifier,
    })

    const xrpcOpts: XrpcServerOptions = {
      validateResponse: config.debugMode,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    }
    if (config.rateLimitsEnabled) {
      const rlCreator = (opts: RateLimiterOpts) =>
        RateLimiter.redis(redis.driver, {
          bypassSecret: config.rateLimitBypassKey,
          bypassIps: config.rateLimitBypassIps,
          ...opts,
        })
      xrpcOpts['rateLimits'] = {
        creator: rlCreator,
        global: [
          {
            name: 'global-unauthed-ip',
            durationMs: 5 * MINUTE,
            points: 3000,
            calcKey: (ctx) => (ctx.auth ? null : ctx.req.ip),
          },
          {
            name: 'global-authed-did',
            durationMs: 5 * MINUTE,
            points: 3000,
            calcKey: (ctx) => ctx.auth?.credentials?.did ?? null,
          },
        ],
      }
    }

    let server = createServer(xrpcOpts)

    server = API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(blobResolver.createRouter(ctx))
    if (imgProcessingServer) {
      app.use('/img', imgProcessingServer.app)
    }
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new BskyAppView({ ctx, app })
  }

  async start(): Promise<http.Server> {
    const { db, backgroundQueue } = this.ctx
    const primary = db.getPrimary()
    const replicas = db.getReplicas()
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: replicas.reduce(
            (tot, replica) => tot + replica.pool.idleCount,
            0,
          ),
          totalCount: replicas.reduce(
            (tot, replica) => tot + replica.pool.totalCount,
            0,
          ),
          waitingCount: replicas.reduce(
            (tot, replica) => tot + replica.pool.waitingCount,
            0,
          ),
          primaryIdleCount: primary.pool.idleCount,
          primaryTotalCount: primary.pool.totalCount,
          primaryWaitingCount: primary.pool.waitingCount,
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
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.cfg.assignPort(port)
    return server
  }

  async destroy(opts?: { skipDb: boolean; skipRedis: boolean }): Promise<void> {
    await this.ctx.didCache.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    if (!opts?.skipRedis) await this.ctx.redis.destroy()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyAppView
