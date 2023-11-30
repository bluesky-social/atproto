import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import { IdResolver } from '@atproto/identity'
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
import DidSqlCache from './did-cache'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { BackgroundQueue } from './background'
import { MountedAlgos } from './feed-gen/types'
import { LabelCache } from './label-cache'
import { NotificationServer } from './notifications'
import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'

export type { ServerConfigValues } from './config'
export type { MountedAlgos } from './feed-gen/types'
export { ServerConfig } from './config'
export { Database, PrimaryDatabase, DatabaseCoordinator } from './db'
export { PeriodicModerationEventReversal } from './db/periodic-moderation-event-reversal'
export { Redis } from './redis'
export { ViewMaintainer } from './db/views'
export { AppContext } from './context'
export { makeAlgos } from './feed-gen'
export * from './indexer'
export * from './ingester'
export { MigrateModerationData } from './migrate-moderation-data'

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
    config: ServerConfig
    signingKey: Keypair
    imgInvalidator?: ImageInvalidator
    algos?: MountedAlgos
  }): BskyAppView {
    const { db, config, signingKey, algos = {} } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

    const didCache = new DidSqlCache(
      db.getPrimary(),
      config.didCacheStaleTTL,
      config.didCacheMaxTTL,
    )
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
    const labelCache = new LabelCache(db.getPrimary())
    const notifServer = new NotificationServer(db.getPrimary())
    const searchAgent = config.searchEndpoint
      ? new AtpAgent({ service: config.searchEndpoint })
      : undefined

    const services = createServices({
      imgUriBuilder,
      imgInvalidator,
      labelCache,
    })

    const ctx = new AppContext({
      db,
      cfg: config,
      services,
      imgUriBuilder,
      signingKey,
      idResolver,
      didCache,
      labelCache,
      backgroundQueue,
      searchAgent,
      algos,
      notifServer,
    })

    let server = createServer({
      validateResponse: config.debugMode,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

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
    this.ctx.labelCache.start()
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.cfg.assignPort(port)
    return server
  }

  async destroy(opts?: { skipDb: boolean }): Promise<void> {
    this.ctx.labelCache.stop()
    await this.ctx.didCache.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    if (!opts?.skipDb) await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyAppView
