import events from 'node:events'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import { DAY, SECOND } from '@atproto/common'
import API, { health, wellKnown } from './api'
import { OzoneConfig, OzoneSecrets } from './config'
import { AppContext, AppContextOptions } from './context'
import { Member } from './db/schema/member'
import * as error from './error'
import { createServer } from './lexicon'
import { dbLogger, loggerMiddleware } from './logger'

export * from './config'
export { type ImageInvalidator } from './image-invalidator'
export { Database } from './db'
export { EventPusher, EventReverser, OzoneDaemon } from './daemon'
export { AppContext } from './context'
export { httpLogger } from './logger'

export class OzoneService {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: HttpTerminator
  private dbStatsInterval?: NodeJS.Timeout

  constructor(opts: { ctx: AppContext; app: express.Application }) {
    this.ctx = opts.ctx
    this.app = opts.app
  }

  static async create(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<OzoneService> {
    const app = express()
    app.set('trust proxy', true)
    app.use(cors({ maxAge: DAY / SECOND }))
    app.use(loggerMiddleware)
    app.use(compression())

    const ctx = await AppContext.fromConfig(cfg, secrets, overrides)

    let server = createServer({
      validateResponse: false,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })

    server = API(server, ctx)

    app.use(health.createRouter(ctx))
    app.use(wellKnown.createRouter(ctx))
    app.use(server.xrpc.router)
    app.use(error.handler)

    return new OzoneService({ ctx, app })
  }

  async seedInitialMembers() {
    const members: Array<{ role: Member['role']; did: string }> = []
    this.ctx.cfg.access.admins.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleAdmin',
        did,
      }),
    )
    this.ctx.cfg.access.triage.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleTriage',
        did,
      }),
    )
    this.ctx.cfg.access.moderators.forEach((did) =>
      members.push({
        role: 'tools.ozone.team.defs#roleModerator',
        did,
      }),
    )

    for (const member of members) {
      const service = this.ctx.teamService(this.ctx.db)
      await service.upsert({
        ...member,
        lastUpdatedBy: this.ctx.cfg.service.did,
      })
    }
  }

  async start(): Promise<http.Server> {
    if (this.dbStatsInterval) {
      throw new Error(`${this.constructor.name} already started`)
    }

    // Any moderator that are configured via env var may not exist in the database
    // so we need to sync them from env var to the database
    await this.seedInitialMembers()

    const { db, backgroundQueue } = this.ctx
    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: db.pool.idleCount,
          totalCount: db.pool.totalCount,
          waitingCount: db.pool.waitingCount,
        },
        'db pool stats',
      )
      dbLogger.info(backgroundQueue.getStats(), 'background queue stats')
    }, 10000)
    await this.ctx.sequencer.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.assignPort(port)
    return server
  }

  async destroy(): Promise<void> {
    await this.terminator?.terminate()
    await this.ctx.backgroundQueue.destroy()
    await this.ctx.sequencer.destroy()
    await this.ctx.db.close()
    clearInterval(this.dbStatsInterval)
    this.dbStatsInterval = undefined
  }
}

export default OzoneService
