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
import * as streamConsumers from './event-stream/consumers'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { ServerMailer } from './mailer'
import { createServer } from './lexicon'
import SqlMessageQueue, {
  MessageDispatcher,
} from './event-stream/message-queue'
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

export * as appMigrations from './app-migrations'
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
    })

    const messageQueue = new SqlMessageQueue('pds', db)
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

    const services = createServices({
      repoSigningKey,
      messageQueue,
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    })

    const ctx = new AppContext({
      db,
      blobstore,
      repoSigningKey,
      plcRotationKey,
      cfg: config,
      auth,
      messageQueue,
      messageDispatcher,
      sequencer,
      services,
      mailer,
      imgUriBuilder,
    })

    const appView = new AppView(ctx)

    let server = createServer({
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
    streamConsumers.listen(this.ctx)
    await this.ctx.sequencer.start()
    await this.ctx.db.startListeningToChannels()
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    this.appView.destroy()
    await this.ctx.messageQueue.destroy()
    await this.terminator?.terminate()
    await this.ctx.db.close()
  }
}

export default PDS
