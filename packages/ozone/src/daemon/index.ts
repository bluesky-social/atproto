import AtpAgent from '@atproto/api'
import Database from '../db'
import { DaemonConfig } from './config'
import DaemonContext from './context'
import * as auth from '../auth'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'
import { ModerationService } from '../mod-service'

export { EventPusher } from './event-pusher'
export { EventReverser } from './event-reverser'

export class OzoneDaemon {
  constructor(public ctx: DaemonContext) {}
  static create(opts: { db: Database; cfg: DaemonConfig }): OzoneDaemon {
    const { db, cfg } = opts
    const appviewAgent = new AtpAgent({ service: cfg.appviewUrl })
    appviewAgent.api.setHeader(
      'authorization',
      auth.buildBasicAuth('admin', cfg.adminPassword),
    )
    const url = new URL(opts.cfg.moderationPushUrl)
    const moderationPushAgent = new AtpAgent({ service: url.origin })
    moderationPushAgent.api.setHeader(
      'authorization',
      auth.buildBasicAuth(url.username, url.password),
    )

    const modService = ModerationService.creator(appviewAgent)
    const eventPusher = new EventPusher(db, appviewAgent, moderationPushAgent)
    const eventReverser = new EventReverser(db, modService)
    const ctx = new DaemonContext({
      db,
      cfg,
      modService,
      eventPusher,
      eventReverser,
    })
    return new OzoneDaemon(ctx)
  }

  async start() {
    this.ctx.eventPusher.start()
    this.ctx.eventReverser.start()
  }

  async processAll() {
    await this.ctx.eventPusher.processAll()
  }

  async destroy() {
    await this.ctx.eventReverser.destroy()
    await this.ctx.eventPusher.destroy()
    await this.ctx.db.close()
  }
}
