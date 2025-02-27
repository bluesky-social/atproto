import events from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import compression from 'compression'
import cors from 'cors'
import { Etcd3 } from 'etcd3'
import express from 'express'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { AtpAgent } from '@atproto/api'
import { DAY, SECOND } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import API, { blobResolver, health, wellKnown } from './api'
import { createBlobDispatcher } from './api/blob-dispatcher'
import { AuthVerifier, createPublicKeyObject } from './auth-verifier'
import { authWithApiKey as bsyncAuth, createBsyncClient } from './bsync'
import { ServerConfig } from './config'
import { AppContext } from './context'
import { authWithApiKey as courierAuth, createCourierClient } from './courier'
import {
  BasicHostList,
  EtcdHostList,
  createDataPlaneClient,
} from './data-plane/client'
import * as error from './error'
import { FeatureGates } from './feature-gates'
import { Hydrator } from './hydration/hydrator'
import * as imageServer from './image/server'
import { ImageUriBuilder } from './image/uri'
import { createServer } from './lexicon'
import { loggerMiddleware } from './logger'
import { Views } from './views'
import { VideoUriBuilder } from './views/util'

export { ServerConfig } from './config'
export type { ServerConfigValues } from './config'
export { AppContext } from './context'
export * from './data-plane'
export { BackgroundQueue } from './data-plane/server/background'
export { Database } from './data-plane/server/db'
export { Redis } from './redis'

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

    const topicsAgent = config.topicsUrl
      ? new AtpAgent({ service: config.topicsUrl })
      : undefined
    if (topicsAgent && config.topicsApiKey) {
      topicsAgent.api.setHeader(
        'authorization',
        `Bearer ${config.topicsApiKey}`,
      )
    }

    const etcd = config.etcdHosts.length
      ? new Etcd3({ hosts: config.etcdHosts })
      : undefined

    const dataplaneHostList =
      etcd && config.dataplaneUrlsEtcdKeyPrefix
        ? new EtcdHostList(
            etcd,
            config.dataplaneUrlsEtcdKeyPrefix,
            config.dataplaneUrls,
          )
        : new BasicHostList(config.dataplaneUrls)

    const dataplane = createDataPlaneClient(dataplaneHostList, {
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

    const blobDispatcher = createBlobDispatcher(config)

    const ctx = new AppContext({
      cfg: config,
      etcd,
      dataplane,
      dataplaneHostList,
      searchAgent,
      suggestionsAgent,
      topicsAgent,
      hydrator,
      views,
      signingKey,
      idResolver,
      bsyncClient,
      courierClient,
      authVerifier,
      featureGates,
      blobDispatcher,
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
    app.use(blobResolver.createMiddleware(ctx))
    app.use(imageServer.createMiddleware(ctx, { prefix: '/img/' }))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new BskyAppView({ ctx, app })
  }

  async start(): Promise<http.Server> {
    if (this.ctx.dataplaneHostList instanceof EtcdHostList) {
      await this.ctx.dataplaneHostList.connect()
    }
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
    await this.ctx.etcd?.close()
  }
}

export default BskyAppView
