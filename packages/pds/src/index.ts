// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import events from 'events'
import { createTransport } from 'nodemailer'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { AppView } from './app-view'
import API, { health } from './api'
import Database from './db'
import { ServerAuth } from './auth'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { ServerMailer } from './mailer'
import { createServer } from './lexicon'
import { MessageDispatcher } from './event-stream/message-queue'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext from './context'
import Sequencer from './sequencer'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { Labeler, HiveLabeler, KeywordLabeler } from './labeler'
import { BackgroundQueue } from './event-stream/background-queue'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { DiskBlobStore, MemoryBlobStore } from './storage'
export { AppContext } from './context'

export class PDS {
  public ctx: AppContext
  public appView: AppView
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: {
    ctx: AppContext
    app: express.Application
    appView: AppView
  }) {
    this.ctx = opts.ctx
    this.app = opts.app
    this.appView = opts.appView
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    imgInvalidator?: ImageInvalidator
    repoSigningKey: crypto.Keypair
    plcRotationKey: crypto.Keypair
    config: ServerConfig
  }): PDS {
    const { db, blobstore, repoSigningKey, plcRotationKey, config } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const auth = new ServerAuth({
      jwtSecret: config.jwtSecret,
      adminPass: config.adminPassword,
      moderatorPass: config.moderatorPassword,
    })

    const messageDispatcher = new MessageDispatcher()
    const sequencer = new Sequencer(db)

    const mailTransport =
      config.emailSmtpUrl !== undefined
        ? createTransport(config.emailSmtpUrl)
        : createTransport({ jsonTransport: true })

    const mailer = new ServerMailer(mailTransport, config)

    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)

    let imgUriEndpoint = config.imgUriEndpoint
    if (!imgUriEndpoint) {
      const imgProcessingCache = new BlobDiskCache(config.blobCacheLocation)
      const imgProcessingServer = new ImageProcessingServer(
        config.imgUriSalt,
        config.imgUriKey,
        blobstore,
        imgProcessingCache,
      )
      maybeImgInvalidator ??= new ImageProcessingServerInvalidator(
        imgProcessingCache,
      )
      app.use('/image', imgProcessingServer.app)
      imgUriEndpoint = `${config.publicUrl}/image`
    }

    let imgInvalidator: ImageInvalidator
    if (maybeImgInvalidator) {
      imgInvalidator = maybeImgInvalidator
    } else {
      throw new Error('Missing PDS image invalidator')
    }

    const imgUriBuilder = new ImageUriBuilder(
      imgUriEndpoint,
      config.imgUriSalt,
      config.imgUriKey,
    )

    const backgroundQueue = new BackgroundQueue(db)

    let labeler: Labeler
    if (config.hiveApiKey) {
      labeler = new HiveLabeler({
        db,
        blobstore,
        backgroundQueue,
        labelerDid: config.labelerDid,
        hiveApiKey: config.hiveApiKey,
        keywords: config.labelerKeywords,
      })
    } else {
      labeler = new KeywordLabeler({
        db,
        blobstore,
        backgroundQueue,
        labelerDid: config.labelerDid,
        keywords: config.labelerKeywords,
      })
    }

    const services = createServices({
      repoSigningKey,
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
      labeler,
      backgroundQueue,
    })

    const ctx = new AppContext({
      db,
      blobstore,
      repoSigningKey,
      plcRotationKey,
      cfg: config,
      auth,
      messageDispatcher,
      sequencer,
      labeler,
      services,
      mailer,
      imgUriBuilder,
      backgroundQueue,
    })

    const appView = new AppView(ctx)

    let server = createServer({
      validateResponse: config.debugMode,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)
    server = appView.api(server)

    app.use(health.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new PDS({
      ctx,
      app,
      appView,
    })
  }

  async start(): Promise<http.Server> {
    this.appView.start()
    await this.ctx.sequencer.start()
    await this.ctx.db.startListeningToChannels()
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    this.appView.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.db.close()
  }
}

export default PDS
