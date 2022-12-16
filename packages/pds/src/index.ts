// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors'

import express from 'express'
import cors from 'cors'
import http from 'http'
import { DidableKey } from '@atproto/auth'
import { BlobStore } from '@atproto/repo'
import { DidResolver } from '@atproto/did-resolver'
import API, { health } from './api'
import Database from './db'
import { ServerAuth } from './auth'
import * as streamConsumers from './event-stream/consumers'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig, ServerConfigValues } from './config'
import { ServerMailer } from './mailer'
import { createTransport } from 'nodemailer'
import SqlMessageQueue from './event-stream/message-queue'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import { createHttpTerminator } from 'http-terminator'
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

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    keypair: DidableKey
    cfg: ServerConfigValues
  }): PDS {
    const { db, blobstore, keypair, cfg } = opts
    const config = new ServerConfig(opts.cfg)
    const didResolver = new DidResolver({ plcUrl: config.didPlcUrl })
    const auth = new ServerAuth({
      jwtSecret: cfg.jwtSecret,
      adminPass: cfg.adminPassword,
      didResolver,
    })

    const messageQueue = new SqlMessageQueue('pds', db)
    streamConsumers.listen(messageQueue, blobstore, auth, keypair)

    const services = createServices(messageQueue, blobstore)

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
    return new Promise((resolve, reject) => {
      server.on('listening', () => {
        resolve(server)
      })
      server.on('error', (err) => {
        reject(err)
      })
    })
  }

  async destroy(force = false): Promise<void> {
    await this.ctx.messageQueue.destroy()
    if (this.server) {
      const terminator = createHttpTerminator({
        server: this.server,
        gracefulTerminationTimeout: force ? 0 : 5000,
      })
      await terminator.terminate()
    }
    await this.ctx.db.close()
  }
}

export default PDS
