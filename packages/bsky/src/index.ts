// catch errors that get thrown in async route handlers
// this is a relatively non-invasive change to express
// they get handled in the error.handler middleware
// leave at top of file before importing Routes
import 'express-async-errors' // @TODO(bsky) remove

import express from 'express'
import http from 'http'
import events from 'events'
import { BlobStore } from '@atproto/repo'
import API, { health } from './api'
import Database from './db'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext from './context'
import { RepoSubscription } from './subscription/repo'

export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { AppContext } from './context'

export class BskyAppView {
  public ctx: AppContext
  public app: express.Application
  public sub: RepoSubscription
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: {
    ctx: AppContext
    app: express.Application
    sub: RepoSubscription
  }) {
    this.ctx = opts.ctx
    this.app = opts.app
    this.sub = opts.sub
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    config: ServerConfig
  }): BskyAppView {
    const { db, blobstore, config } = opts
    const app = express()
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

    const services = createServices({
      imgUriBuilder,
    })

    const ctx = new AppContext({
      db,
      blobstore,
      cfg: config,
      services,
      imgUriBuilder,
    })

    let server = createServer({
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    const sub = new RepoSubscription(ctx, config.repoProvider)

    return new BskyAppView({ ctx, app, sub })
  }

  async start(): Promise<http.Server> {
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    await this.sub.run()
    return server
  }

  async destroy(): Promise<void> {
    this.sub.destroy()
    await this.terminator?.terminate()
    await this.ctx.db.close()
  }
}

export default BskyAppView
