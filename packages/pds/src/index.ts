// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import events from 'events'
import { DidableKey } from '@atproto/auth'
import { BlobStore } from '@atproto/repo'
import { DidResolver } from '@atproto/did-resolver'
import API, { health } from './api'
import Database from './db'
import { ServerAuth } from './auth'
import * as streamConsumers from './event-stream/consumers'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { ServerMailer } from './mailer'
import { createTransport } from 'nodemailer'
import SqlMessageQueue from './event-stream/message-queue'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext from './context'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { DiskBlobStore, MemoryBlobStore } from './storage'
export { AppContext } from './context'

export class PDS {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    keypair: DidableKey
    config: ServerConfig
  }): PDS {
    const { db, blobstore, keypair, config } = opts
    const didResolver = new DidResolver({ plcUrl: config.didPlcUrl })
    const auth = new ServerAuth({
      jwtSecret: config.jwtSecret,
      adminPass: config.adminPassword,
      didResolver,
    })

    const messageQueue = new SqlMessageQueue('pds', db)

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
      app.use('/image', imgProcessingServer.app)
      imgUriEndpoint = `${config.publicUrl}/image`
    }

    const imgUriBuilder = new ImageUriBuilder(
      imgUriEndpoint,
      config.imgUriSalt,
      config.imgUriKey,
    )

    const services = createServices({ messageQueue, blobstore, imgUriBuilder })

    const ctx = new AppContext({
      db,
      blobstore,
      keypair,
      cfg: config,
      auth,
      messageQueue,
      services,
      mailer,
      imgUriBuilder,
    })

    streamConsumers.listen(ctx)

    const apiServer = API(ctx, {
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    app.use(health.createRouter(ctx))
    app.use(apiServer.xrpc.router)
    app.use(error.handler)

    return new PDS({
      ctx,
      app,
    })
  }

  async start(): Promise<http.Server> {
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    await this.ctx.messageQueue.destroy()
    await this.terminator?.terminate()
    await this.ctx.db.close()
  }
}

export default PDS
