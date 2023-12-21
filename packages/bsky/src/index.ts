import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import { DidCache, IdResolver } from '@atproto/identity'
import API, { health, wellKnown, blobResolver } from './api'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import AppContext from './context'
import { MountedAlgos } from './api/feed-gen/types'
import { Keypair } from '@atproto/crypto'
import { createDataPlaneClient } from './data-plane/client'
import { Hydrator } from './hydration/hydrator'
import { Views } from './views'

export * from './data-plane'
export type { ServerConfigValues } from './config'
export type { MountedAlgos } from './api/feed-gen/types'
export { ServerConfig } from './config'
export {
  Database,
  PrimaryDatabase,
  DatabaseCoordinator,
} from './data-plane/server/db'
export { Redis } from './redis'
export { AppContext } from './context'
export { makeAlgos } from './api/feed-gen'

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
    config: ServerConfig
    signingKey: Keypair
    didCache?: DidCache
    algos?: MountedAlgos
  }): BskyAppView {
    const { config, signingKey, didCache, algos = {} } = opts
    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

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
    }

    const dataplane = createDataPlaneClient(config.dataplaneUrl, '1.1')
    const hydrator = new Hydrator(dataplane)
    const views = new Views(imgUriBuilder)

    const ctx = new AppContext({
      cfg: config,
      dataplane,
      hydrator,
      views,
      signingKey,
      idResolver,
      didCache,
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
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.cfg.assignPort(port)
    return server
  }

  async destroy(): Promise<void> {
    await this.terminator?.terminate()
  }
}

export default BskyAppView
