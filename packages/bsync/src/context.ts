import { EventEmitter } from 'node:stream'
import TypedEventEmitter from 'typed-emitter'
import { ServerConfig } from './config'
import { Database } from './db'
import { createMuteOpChannel } from './db/schema/mute_op'
import { createNotifOpChannel } from './db/schema/notif_op'
import { createOperationChannel } from './db/schema/operation'

export type AppContextOptions = {
  db: Database
  cfg: ServerConfig
  shutdown: AbortSignal
}

export class AppContext {
  db: Database
  cfg: ServerConfig
  shutdown: AbortSignal
  events: TypedEventEmitter<AppEvents>

  constructor(opts: AppContextOptions) {
    this.db = opts.db
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
    return new AppContext({ db, cfg, shutdown, ...overrides })
  }
}

export type AppEvents = {
  [createMuteOpChannel]: () => void
  [createNotifOpChannel]: () => void
  [createOperationChannel]: () => void
}
