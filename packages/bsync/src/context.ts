import { ServerConfig } from './config'
import Database from './db'

export type AppContextOptions = {
  db: Database
  cfg: ServerConfig
}

export class AppContext {
  db: Database
  cfg: ServerConfig

  constructor(private opts: AppContextOptions) {
    this.db = opts.db
    this.cfg = opts.cfg
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
