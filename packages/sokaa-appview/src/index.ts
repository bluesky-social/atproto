import events from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { DAY, SECOND } from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import API, { health } from './api'
import { AuthVerifier } from './auth-verifier'
import { ServerConfig } from './config'
import { AppContext } from './context'
import { createDataPlaneClient } from './data-plane/client'
import { Database } from './data-plane/server/db'
import * as error from './error'
import { Hydrator } from './hydration/hydrator'
import { createServer } from './lexicon'
import { loggerMiddleware } from './logger'
import { Views } from './views'
import { CdnUriBuilder } from './views/uri'

export const PACKAGE_NAME = '@atproto/sokaa-appview'
export { Database } from './data-plane/server/db'
export type { DatabaseSchema } from './data-plane/server/db'
export { IndexingService } from './data-plane/server/indexing'
export { RepoSubscription } from './data-plane/server/subscription'
export { DataPlaneServer } from './data-plane/server/dataplane-server'
export {
  type DataPlaneClient,
  createDataPlaneClient,
} from './data-plane/client'
export { ServerConfig } from './config'
export type { ServerConfigValues } from './config'
export { AppContext } from './context'

export class SokaaAppView {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: { config: ServerConfig; db: Database }): SokaaAppView {
    const { config, db } = opts
    const app = express()
    app.set('trust proxy', true)
    app.use(cors({ maxAge: DAY / SECOND }))
    app.use(loggerMiddleware)
    app.use(compression())

    const idResolver = new IdResolver({
      plcUrl: config.didPlcUrl,
    })

    const dataplane = createDataPlaneClient(config.dataplaneUrl)
    const hydrator = new Hydrator(dataplane, db)
    const cdnUriBuilder = new CdnUriBuilder({
      cdnUrl: config.cdnUrl,
      videoPlaylistUrlPattern: config.videoPlaylistUrlPattern,
      videoThumbnailUrlPattern: config.videoThumbnailUrlPattern,
    })
    const views = new Views(cdnUriBuilder)

    const authVerifier = new AuthVerifier(idResolver, {
      ownDid: config.serverDid,
      alternateAudienceDids: config.alternateAudienceDids,
      adminPasswords: config.adminPasswords,
    })

    const ctx = new AppContext({
      cfg: config,
      dataplane,
      hydrator,
      views,
      authVerifier,
      idResolver,
    })

    let server = createServer({
      validateResponse: config.debugMode,
      payload: {
        jsonLimit: 100 * 1024,
        textLimit: 100 * 1024,
        blobLimit: 5 * 1024 * 1024,
      },
    })

    server = API(server, ctx)

    app.use(health(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new SokaaAppView({ ctx, app })
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

export default SokaaAppView
