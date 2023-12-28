import AtpAgent from '@atproto/api'
import Database from '../db'
import { DaemonConfig } from './config'
import DaemonContext from './context'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'
import { ModerationService } from '../mod-service'
import { Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'

export { DaemonConfig } from './config'
export { EventPusher } from './event-pusher'
export { EventReverser } from './event-reverser'

export class OzoneDaemon {
  constructor(public ctx: DaemonContext) {}
  static create(opts: {
    db: Database
    signingKey: Keypair
    cfg: DaemonConfig
  }): OzoneDaemon {
    const { db, signingKey, cfg } = opts
    const appviewAgent = new AtpAgent({ service: cfg.appviewUrl })
    const createAuthHeaders = (aud: string) =>
      createServiceAuthHeaders({ iss: cfg.serverDid, aud, keypair: signingKey })

    const appviewAuth = async () =>
      cfg.appviewDid ? createAuthHeaders(cfg.appviewDid) : undefined

    const modService = ModerationService.creator(appviewAgent, appviewAuth)
    const eventPusher = new EventPusher(db, createAuthHeaders, {
      appview:
        cfg.appviewUrl && cfg.appviewDid
          ? {
              url: cfg.appviewUrl,
              did: cfg.appviewDid,
            }
          : undefined,
      pds:
        cfg.pdsUrl && cfg.pdsDid
          ? {
              url: cfg.pdsUrl,
              did: cfg.pdsDid,
            }
          : undefined,
    })
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
