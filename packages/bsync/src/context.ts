import TypedEventEmitter from 'typed-emitter'
import { ServerConfig } from './config'
import Database from './db'
import { createMuteOpChannel } from './db/schema/mute_op'
import { createNotifOpChannel } from './db/schema/notif_op'
import { EventEmitter } from 'stream'
import { RevenueCatClient } from './subscriptions'

export type AppContextOptions = {
  db: Database
  revenueCatClient: RevenueCatClient | undefined
  cfg: ServerConfig
  shutdown: AbortSignal
}

export class AppContext {
  db: Database
  revenueCatClient: RevenueCatClient | undefined
  cfg: ServerConfig
  shutdown: AbortSignal
  events: TypedEventEmitter<AppEvents>

  constructor(opts: AppContextOptions) {
    this.db = opts.db
    this.revenueCatClient = opts.revenueCatClient
    this.cfg = opts.cfg
    this.shutdown = opts.shutdown
    this.events = new EventEmitter() as TypedEventEmitter<AppEvents>
  }

  static async fromConfig(
    cfg: ServerConfig,
    shutdown: AbortSignal,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const db = new Database({
      url: cfg.db.url,
      schema: cfg.db.schema,
      poolSize: cfg.db.poolSize,
      poolMaxUses: cfg.db.poolMaxUses,
      poolIdleTimeoutMs: cfg.db.poolIdleTimeoutMs,
    })

    let revenueCatClient: RevenueCatClient | undefined
    if (cfg.revenueCat) {
      revenueCatClient = new RevenueCatClient({
        v1ApiKey: cfg.revenueCat.v1ApiKey,
        v1ApiUrl: cfg.revenueCat.v1ApiUrl,
        webhookAuthorization: cfg.revenueCat.webhookAuthorization,
      })
    }

    return new AppContext({ db, revenueCatClient, cfg, shutdown, ...overrides })
  }
}

export default AppContext

export type AppEvents = {
  [createMuteOpChannel]: () => void
  [createNotifOpChannel]: () => void
}
