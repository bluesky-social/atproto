import AtpAgent from '@atproto/api'
import Database from '../db'
import { createServices } from '../services'
import { DaemonConfig } from './config'
import DaemonContext from './context'
import * as auth from '../auth'

export class OzoneDaemon {
  constructor(private ctx: DaemonContext) {}
  static create(opts: { db: Database; cfg: DaemonConfig }): OzoneDaemon {
    const { db, cfg } = opts
    const appviewAgent = new AtpAgent({ service: cfg.appviewUrl })
    appviewAgent.api.setHeader(
      'authorization',
      auth.buildBasicAuth('admin', cfg.adminPassword),
    )

    const services = createServices(appviewAgent)
    const ctx = new DaemonContext({
      db,
      cfg,
      services,
    })
    return new OzoneDaemon(ctx)
  }
  async start() {}
  async destroy() {}
}
