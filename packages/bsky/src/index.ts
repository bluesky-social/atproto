import express from 'express'
import http from 'http'
import { AddressInfo } from 'net'
import events from 'events'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import cors from 'cors'
import compression from 'compression'
import { AtpAgent } from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import { DAY, SECOND } from '@atproto/common'
import API, { health, wellKnown, blobResolver } from './api'
import * as error from './error'
import { loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { createServer } from './lexicon'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import AppContext from './context'
import { Keypair } from '@atproto/crypto'
import { createDataPlaneClient } from './data-plane/client'
import { Hydrator } from './hydration/hydrator'
import { Views } from './views'
import { AuthVerifier, createPublicKeyObject } from './auth-verifier'
import { authWithApiKey as bsyncAuth, createBsyncClient } from './bsync'
import { authWithApiKey as courierAuth, createCourierClient } from './courier'
import { FeatureGates } from './feature-gates'
import { VideoUriBuilder } from './views/util'

export * from './data-plane'
export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './data-plane/server/db'
export { Redis } from './redis'
export { AppContext } from './context'
export { BackgroundQueue } from './data-plane/server/background'

export class BskyAppView {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    config: ServerConfig
    signingKey: Keypair
  }): BskyAppView {
    const { config, signingKey } = opts
    const app = express()
    app.use(cors({ maxAge: DAY / SECOND }))
    app.use(loggerMiddleware)
    app.use(compression())

    // used solely for handle resolution: identity lookups occur on dataplane
    const idResolver = new IdResolver({
      plcUrl: config.didPlcUrl,
      backupNameservers: config.handleResolveNameservers,
    })

    const imgUriBuilder = new ImageUriBuilder(
      config.cdnUrl || `${config.publicUrl}/img`,
    )
    const videoUriBuilder = new VideoUriBuilder({
      playlistUrlPattern:
        config.videoPlaylistUrlPattern ||
        `${config.publicUrl}/vid/%s/%s/playlist.m3u8`,
      thumbnailUrlPattern:
        config.videoThumbnailUrlPattern ||
        `${config.publicUrl}/vid/%s/%s/thumbnail.jpg`,
    })

    let imgProcessingServer: ImageProcessingServer | undefined
    if (!config.cdnUrl) {
      const imgProcessingCache = new BlobDiskCache(config.blobCacheLocation)
      imgProcessingServer = new ImageProcessingServer(
        config,
        imgProcessingCache,
      )
    }

    const searchAgent = config.searchUrl
      ? new AtpAgent({ service: config.searchUrl })
      : undefined

    const suggestionsAgent = config.suggestionsUrl
      ? new AtpAgent({ service: config.suggestionsUrl })
      : undefined
    if (suggestionsAgent && config.suggestionsApiKey) {
      suggestionsAgent.api.setHeader(
        'authorization',
        `Bearer ${config.suggestionsApiKey}`,
      )
    }

    const dataplane = createDataPlaneClient(config.dataplaneUrls, {
      httpVersion: config.dataplaneHttpVersion,
      rejectUnauthorized: !config.dataplaneIgnoreBadTls,
    })
    const hydrator = new Hydrator(dataplane, config.labelsFromIssuerDids)
    const views = new Views({
      imgUriBuilder: imgUriBuilder,
      videoUriBuilder: videoUriBuilder,
      indexedAtEpoch: config.indexedAtEpoch,
    })

    const bsyncClient = createBsyncClient({
      baseUrl: config.bsyncUrl,
      httpVersion: config.bsyncHttpVersion ?? '2',
      nodeOptions: { rejectUnauthorized: !config.bsyncIgnoreBadTls },
      interceptors: config.bsyncApiKey ? [bsyncAuth(config.bsyncApiKey)] : [],
    })

    const courierClient = config.courierUrl
      ? createCourierClient({
          baseUrl: config.courierUrl,
          httpVersion: config.courierHttpVersion ?? '2',
          nodeOptions: { rejectUnauthorized: !config.courierIgnoreBadTls },
          interceptors: config.courierApiKey
            ? [courierAuth(config.courierApiKey)]
            : [],
        })
      : undefined

    const entrywayJwtPublicKey = config.entrywayJwtPublicKeyHex
      ? createPublicKeyObject(config.entrywayJwtPublicKeyHex)
      : undefined
    const authVerifier = new AuthVerifier(dataplane, {
      ownDid: config.serverDid,
      alternateAudienceDids: config.alternateAudienceDids,
      modServiceDid: config.modServiceDid,
      adminPasses: config.adminPasswords,
      entrywayJwtPublicKey,
    })

    const featureGates = new FeatureGates({
      apiKey: config.statsigKey,
      env: config.statsigEnv,
    })

    const ctx = new AppContext({
      cfg: config,
      dataplane,
      searchAgent,
      suggestionsAgent,
      hydrator,
      views,
      signingKey,
      idResolver,
      bsyncClient,
      courierClient,
      authVerifier,
      featureGates,
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
    await this.ctx.featureGates.start()
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
    this.ctx.featureGates.destroy()
  }
}

export default BskyAppView
