import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import { IdResolver } from '@atproto/identity'
import API, { health, blobResolver } from './api'
import Database from './db'
import * as error from './error'
import { dbLogger, loggerMiddleware, subLogger } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import AppContext from './context'
import { RepoSubscription } from './subscription/repo'
import DidSqlCache from './did-cache'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { HiveLabeler, KeywordLabeler, Labeler } from './labeler'
import { BackgroundQueue } from './background'
import { MountedAlgos } from './feed-gen/types'

export type { ServerConfigValues } from './config'
export type { MountedAlgos } from './feed-gen/types'
export { ServerConfig } from './config'
export { Database } from './db'
export { ViewMaintainer } from './db/views'
export { AppContext } from './context'
export { makeAlgos } from './feed-gen'

export class BskyAppView {
  public ctx: AppContext
  public app: express.Application
  public sub?: RepoSubscription
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval: NodeJS.Timer
  private subStatsInterval: NodeJS.Timer

  constructor(opts: {
    ctx: AppContext
    app: express.Application
    sub?: RepoSubscription
  }) {
    this.ctx = opts.ctx
    this.app = opts.app
    this.sub = opts.sub
  }

  static create(opts: {
    db: Database
    config: ServerConfig
    imgInvalidator?: ImageInvalidator
    algos?: MountedAlgos
  }): BskyAppView {
    const { db, config, algos = {} } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

    const didCache = new DidSqlCache(
      db,
      config.didCacheStaleTTL,
      config.didCacheMaxTTL,
    )
    const idResolver = new IdResolver({ plcUrl: config.didPlcUrl, didCache })

    const imgUriBuilder = new ImageUriBuilder(
      config.imgUriEndpoint || `${config.publicUrl}/image`,
      config.imgUriSalt,
      config.imgUriKey,
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

    const backgroundQueue = new BackgroundQueue(db)

    // @TODO background labeling tasks
    let labeler: Labeler
    if (config.hiveApiKey) {
      labeler = new HiveLabeler(config.hiveApiKey, {
        db,
        cfg: config,
        idResolver,
        backgroundQueue,
      })
    } else {
      labeler = new KeywordLabeler({
        db,
        cfg: config,
        idResolver,
        backgroundQueue,
      })
    }

    const services = createServices({
      imgUriBuilder,
      imgInvalidator,
      idResolver,
      labeler,
      backgroundQueue,
    })

    const ctx = new AppContext({
      db,
      cfg: config,
      services,
      imgUriBuilder,
      idResolver,
      didCache,
      labeler,
      backgroundQueue,
      algos,
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
    app.use(blobResolver.createRouter(ctx))
    if (imgProcessingServer) {
      app.use('/image', imgProcessingServer.app)
    }
    app.use(server.xrpc.router)
    app.use(error.handler)

    const sub = config.repoProvider
      ? new RepoSubscription(
          ctx,
          config.repoProvider,
          config.repoSubLockId,
          config.indexerConcurrency,
        )
      : undefined

    return new BskyAppView({ ctx, app, sub })
  }

  async start(): Promise<http.Server> {
    const { db, backgroundQueue } = this.ctx
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
    if (this.sub) {
      this.subStatsInterval = setInterval(() => {
        subLogger.info(
          {
            seq: this.sub?.lastSeq,
            cursor: this.sub?.lastCursor,
            runningCount: this.sub?.repoQueue.main.pending,
            waitingCount: this.sub?.repoQueue.main.size,
          },
          'repo subscription stats',
        )
      }, 500)
    }
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.cfg.assignPort(port)
    this.sub?.run() // Don't await, backgrounded
    return server
  }

  async destroy(): Promise<void> {
    await this.ctx.didCache.destroy()
    await this.sub?.destroy()
    clearInterval(this.subStatsInterval)
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default BskyAppView
