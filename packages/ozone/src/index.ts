import events from 'node:events'
import type http from 'node:http'
import type { AddressInfo } from 'node:net'
import compression from 'compression'
import cors from 'cors'
import express from 'express'
// eslint-disable-next-line import/default
import httpTerminator from 'http-terminator'
import { DAY, SECOND } from '@atproto/common'
import API, { health, wellKnown } from './api/index.js'
import type { OzoneConfig, OzoneSecrets } from './config/index.js'
import { AppContext, type AppContextOptions } from './context.js'
import type { Member } from './db/schema/member.js'
import * as error from './error.js'
import { createServer } from './lexicon/index.js'
import { dbLogger, loggerMiddleware } from './logger.js'

export * from './config/index.js'
export { type ImageInvalidator } from './image-invalidator.js'
export { Database } from './db/index.js'
export { EventPusher, EventReverser, OzoneDaemon } from './daemon/index.js'
export { AppContext } from './context.js'
export { httpLogger } from './logger.js'

export class OzoneService {
  public ctx: AppContext
  public app: express.Application
  public server?: http.Server
  private terminator?: httpTerminator.HttpTerminator
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

    this.dbStatsInterval = setInterval(() => {
      dbLogger.info(
        {
          idleCount: this.ctx.db.pool.idleCount,
          totalCount: this.ctx.db.pool.totalCount,
          waitingCount: this.ctx.db.pool.waitingCount,
        },
        'db pool stats',
      )
      dbLogger.info(
        this.ctx.backgroundQueue.getStats(),
        'background queue stats',
      )
    }, 10000)
    await this.ctx.sequencer.start()
    const server = this.app.listen(this.ctx.cfg.service.port)
    this.server = server
    server.keepAliveTimeout = 90000
    this.terminator = httpTerminator.createHttpTerminator({ server })
    await events.once(server, 'listening')
    const { port } = server.address() as AddressInfo
    this.ctx.assignPort(port)
    return server
  }

  async destroy(): Promise<void> {
    clearInterval(this.dbStatsInterval)
    this.dbStatsInterval = undefined

    // @TODO Use a disposable stack when Node24 becomes the min supported version
    try {
      await this.terminator?.terminate()
    } finally {
      try {
        await this.ctx.backgroundQueue.destroy()
      } finally {
        try {
          await this.ctx.sequencer.destroy()
        } finally {
          await this.ctx.db.close()
        }
      }
    }
  }
}

export default OzoneService
