import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import { DidResolver } from '@atproto/did-resolver'
import API, { health, blobResolver } from './api'
import Database from './db'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import AppContext from './context'
import { RepoSubscription } from './subscription/repo'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { HiveLabeler, KeywordLabeler, Labeler } from './labeler'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { AppContext } from './context'

export class BskyAppView {
  public ctx: AppContext
  public app: express.Application
  public sub?: RepoSubscription
  public server?: http.Server
  private terminator?: HttpTerminator

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
  }): BskyAppView {
    const { db, config } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)

    const didResolver = new DidResolver({ plcUrl: config.didPlcUrl })

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

    let labeler: Labeler
    if (config.hiveApiKey) {
      labeler = new HiveLabeler(config.hiveApiKey, {
        db,
        cfg: config,
        didResolver,
      })
    } else {
      labeler = new KeywordLabeler({
        db,
        cfg: config,
        didResolver,
      })
    }

    const services = createServices({
      imgUriBuilder,
      imgInvalidator,
      didResolver,
      labeler,
    })

    const ctx = new AppContext({
      db,
      cfg: config,
      services,
      imgUriBuilder,
      didResolver,
      labeler,
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
      ? new RepoSubscription(ctx, config.repoProvider, config.repoSubLockId)
      : undefined

    return new BskyAppView({ ctx, app, sub })
  }

  async start(): Promise<http.Server> {
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.cfg.assignPort(port)
    this.sub?.run() // Don't await, backgrounded
    return server
  }

  async destroy(): Promise<void> {
    await this.sub?.destroy()
    await this.ctx.labeler.destroy()
    await this.terminator?.terminate()
    await this.ctx.db.close()
  }
}

export default BskyAppView
