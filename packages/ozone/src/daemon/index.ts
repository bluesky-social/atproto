import AtpAgent from '@atproto/api'
import Database from '../db'
import { createServices } from '../services'
import { DaemonConfig } from './config'
import DaemonContext from './context'
import * as auth from '../auth'
import { EventPusher } from './event-pusher'

export class OzoneDaemon {
  constructor(private ctx: DaemonContext) {}
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

    const services = createServices(appviewAgent)
    const eventPusher = new EventPusher(db, appviewAgent, moderationPushAgent)
    const ctx = new DaemonContext({
      db,
      cfg,
      services,
      eventPusher,
    })
    return new OzoneDaemon(ctx)
  }

  async start() {
    this.ctx.eventPusher.start()
  }

  async processAll() {
    await this.ctx.eventPusher.processAll()
  }

  async destroy() {
    await this.ctx.eventPusher.destroy()
    await this.ctx.db.close()
  }
}
