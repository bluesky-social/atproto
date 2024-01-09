import TypedEventEmitter from 'typed-emitter'
import { ServerConfig } from './config'
import Database from './db'
import { createMuteOpChannel } from './db/schema/mute_op'
import { EventEmitter } from 'stream'

export type AppContextOptions = {
  db: Database
  cfg: ServerConfig
}

export class AppContext {
  db: Database
  cfg: ServerConfig
  events: TypedEventEmitter<AppEvents>

  constructor(opts: AppContextOptions) {
    this.db = opts.db
    this.cfg = opts.cfg
    this.events = new EventEmitter() as TypedEventEmitter<AppEvents>
  }

  static async fromConfig(
    cfg: ServerConfig,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const db = new Database({
      url: cfg.db.url,
      schema: cfg.db.schema,
      poolSize: cfg.db.poolSize,
      poolMaxUses: cfg.db.poolMaxUses,
      poolIdleTimeoutMs: cfg.db.poolIdleTimeoutMs,
    })
    return new AppContext({ db, cfg, ...overrides })
  }
}

export default AppContext

export type AppEvents = {
  [createMuteOpChannel]: () => void
}
