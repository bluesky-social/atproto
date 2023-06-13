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
import API from './api'
import * as basicRoutes from './basic-routes'
import * as wellKnown from './well-known'
import Database from './db'
import { ServerAuth } from './auth'
import * as error from './error'
import { dbLogger, loggerMiddleware } from './logger'
import { ServerConfig } from './config'
import { ServerMailer } from './mailer'
import { createServer } from './lexicon'
import { createServices } from './services'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'
import AppContext from './context'
import { Sequencer, SequencerLeader } from './sequencer'
import { BackgroundQueue } from './background'
import DidSqlCache from './did-cache'
import { IdResolver } from '@atproto/identity'
import { Crawlers } from './crawlers'

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
  private dbStatsInterval?: NodeJS.Timer

  constructor(opts: {
    ctx: AppContext
    app: express.Application
    sequencerLeader: SequencerLeader
  }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static create(opts: {
    db: Database
    blobstore: BlobStore
    repoSigningKey: crypto.Keypair
    plcRotationKey: crypto.Keypair
    config: ServerConfig
  }): PDS {
    const { db, blobstore, repoSigningKey, plcRotationKey, config } = opts
    const auth = new ServerAuth({
      jwtSecret: config.jwtSecret,
      adminPass: config.adminPassword,
      moderatorPass: config.moderatorPassword,
    })

    const didCache = new DidSqlCache(
      db,
      config.didCacheStaleTTL,
      config.didCacheMaxTTL,
    )
    const idResolver = new IdResolver({ plcUrl: config.didPlcUrl, didCache })

    const sequencer = new Sequencer(db)
    const sequencerLeader = new SequencerLeader(
      db,
      config.sequencerLeaderLockId,
    )

    const mailTransport =
      config.emailSmtpUrl !== undefined
        ? createTransport(config.emailSmtpUrl)
        : createTransport({ jsonTransport: true })

    const mailer = new ServerMailer(mailTransport, config)

    const app = express()
    app.use(cors())
    app.use(loggerMiddleware)

    const backgroundQueue = new BackgroundQueue(db)
    const crawlers = new Crawlers(
      config.publicHostname,
      config.crawlersToNotify ?? [],
    )

    const services = createServices({
      repoSigningKey,
      blobstore,
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
      sequencer,
      sequencerLeader,
      services,
      mailer,
      backgroundQueue,
      crawlers,
    })

    let server = createServer({
      validateResponse: false,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)

    app.use(basicRoutes.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new PDS({
      ctx,
      app,
      sequencerLeader,
    })
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
    this.ctx.sequencerLeader.run()
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
    await this.ctx.sequencerLeader.destroy()
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
  }
}

export default PDS
