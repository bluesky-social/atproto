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
import { IdResolver } from '@atproto/identity'
import * as appviewConsumers from './app-view/event-stream/consumers'
import inProcessAppView from './app-view/api'
import API from './api'
import * as basicRoutes from './basic-routes'
import * as wellKnown from './well-known'
import Database from './db'
import { ServerAuth } from './auth'
import * as error from './error'
import compression from './util/compression'
import { dbLogger, loggerMiddleware, seqLogger } from './logger'
import { ServerConfig } from './config'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { createServer } from './lexicon'
import { MessageDispatcher } from './event-stream/message-queue'
import { ImageUriBuilder } from './image/uri'
import { BlobDiskCache, ImageProcessingServer } from './image/server'
import { createServices } from './services'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext from './context'
import { Sequencer, SequencerLeader } from './sequencer'
import {
  ImageInvalidator,
  ImageProcessingServerInvalidator,
} from './image/invalidator'
import { Labeler, HiveLabeler, KeywordLabeler } from './labeler'
import { BackgroundQueue } from './event-stream/background-queue'
import DidSqlCache from './did-cache'
import { MountedAlgos } from './feed-gen/types'
import { Crawlers } from './crawlers'
import { LabelCache } from './label-cache'
import { ContentReporter } from './content-reporter'
import { ModerationService } from './services/moderation'

export type { MountedAlgos } from './feed-gen/types'
export type { ServerConfigValues } from './config'
export { ServerConfig } from './config'
export { Database } from './db'
export { ViewMaintainer } from './db/views'
export { DiskBlobStore, MemoryBlobStore } from './storage'
export { AppContext } from './context'
export { makeAlgos } from './feed-gen'

export class PDS {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timer
  private sequencerStatsInterval?: NodeJS.Timer

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    imgInvalidator?: ImageInvalidator
    repoSigningKey: crypto.Keypair
    plcRotationKey: crypto.Keypair
    algos?: MountedAlgos
    config: ServerConfig
  }): PDS {
    const {
      db,
      blobstore,
      repoSigningKey,
      plcRotationKey,
      algos = {},
      config,
    } = opts
    let maybeImgInvalidator = opts.imgInvalidator
    const auth = new ServerAuth({
      jwtSecret: config.jwtSecret,
      adminPass: config.adminPassword,
      moderatorPass: config.moderatorPassword,
      triagePass: config.triagePassword,
    })

    const didCache = new DidSqlCache(
      db,
      config.didCacheStaleTTL,
      config.didCacheMaxTTL,
    )
    const idResolver = new IdResolver({
      plcUrl: config.didPlcUrl,
      didCache,
      backupNameservers: config.handleResolveNameservers,
    })

    const messageDispatcher = new MessageDispatcher()
    const sequencer = new Sequencer(db)
    const sequencerLeader = config.sequencerLeaderEnabled
      ? new SequencerLeader(db, config.sequencerLeaderLockId)
      : null

    const serverMailTransport =
      config.emailSmtpUrl !== undefined
        ? createTransport(config.emailSmtpUrl)
        : createTransport({ jsonTransport: true })

    const moderationMailTransport =
      config.moderationEmailSmtpUrl !== undefined
        ? createTransport(config.moderationEmailSmtpUrl)
        : createTransport({ jsonTransport: true })

    const mailer = new ServerMailer(serverMailTransport, config)
    const moderationMailer = new ModerationMailer(
      moderationMailTransport,
      config,
    )

    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)
    app.use(compression())

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
    const crawlers = new Crawlers(
      config.hostname,
      config.crawlersToNotify ?? [],
    )

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

    const labelCache = new LabelCache(db)

    let contentReporter: ContentReporter | undefined = undefined
    if (config.unacceptableWordsB64) {
      contentReporter = new ContentReporter({
        backgroundQueue,
        moderationService: new ModerationService(
          db,
          messageDispatcher,
          blobstore,
          imgUriBuilder,
          imgInvalidator,
        ),
        reporterDid: config.labelerDid,
        unacceptableB64: config.unacceptableWordsB64,
        falsePositivesB64: config.falsePositiveWordsB64,
      })
    }

    const services = createServices({
      repoSigningKey,
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
      labeler,
      labelCache,
      contentReporter,
      backgroundQueue,
      crawlers,
    })

    const ctx = new AppContext({
      db,
      blobstore,
      repoSigningKey,
      plcRotationKey,
      idResolver,
      didCache,
      cfg: config,
      auth,
      messageDispatcher,
      sequencer,
      sequencerLeader,
      labeler,
      labelCache,
      contentReporter,
      services,
      mailer,
      moderationMailer,
      imgUriBuilder,
      backgroundQueue,
      crawlers,
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
    server = inProcessAppView(server, ctx)

    app.use(basicRoutes.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new PDS({ ctx, app })
  }

  async start(): Promise<http.Server> {
    const { db, backgroundQueue } = this.ctx
    if (db.cfg.dialect === 'pg') {
      const { pool } = db.cfg
      this.dbStatsInterval = setInterval(() => {
        dbLogger.info(
          {
            idleCount: pool.idleCount,
            totalCount: pool.totalCount,
            waitingCount: pool.waitingCount,
          },
          'db pool stats',
        )
        dbLogger.info(
          {
            runningCount: backgroundQueue.queue.pending,
            waitingCount: backgroundQueue.queue.size,
          },
          'background queue stats',
        )
      }, 10000)
    }
    this.sequencerStatsInterval = setInterval(async () => {
      if (this.ctx.sequencerLeader?.isLeader) {
        try {
          const seq = await this.ctx.sequencerLeader.lastSeq()
          seqLogger.info({ seq }, 'sequencer leader stats')
        } catch (err) {
          seqLogger.error({ err }, 'error getting last seq')
        }
      }
    }, 500)
    appviewConsumers.listen(this.ctx)
    this.ctx.sequencerLeader?.run()
    await this.ctx.sequencer.start()
    await this.ctx.db.startListeningToChannels()
    this.ctx.labelCache.start()
    const server = this.app.listen(this.ctx.cfg.port)
    this.server = server
    this.server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    return server
  }

  async destroy(): Promise<void> {
    this.ctx.labelCache.stop()
    await this.ctx.sequencerLeader?.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
    clearInterval(this.sequencerStatsInterval)
  }
}

export default PDS
