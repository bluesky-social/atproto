import { EventEmitter } from 'node:events'
import type { ServerConfig } from './config.js'
import { type DataplaneClient, createDataplaneClient } from './dataplane.js'
import { Database } from './db/index.js'
import type { createMuteOpChannel } from './db/schema/mute_op.js'
import type { createNotifOpChannel } from './db/schema/notif_op.js'
import type { createOperationChannel } from './db/schema/operation.js'

export type AppContextOptions = {
  db: Database
  cfg: ServerConfig
  shutdown: AbortSignal
  dataplaneClients: DataplaneClient[]
}

export class AppContext {
  db: Database
  cfg: ServerConfig
  shutdown: AbortSignal
  events: EventEmitter<AppEvents>
  dataplaneClients: DataplaneClient[]

  constructor(opts: AppContextOptions) {
    this.db = opts.db
    this.cfg = opts.cfg
    this.shutdown = opts.shutdown
    this.events = new EventEmitter<AppEvents>()
    this.dataplaneClients = opts.dataplaneClients
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
    const dataplaneClients = cfg.dataplane.urls.map((baseUrl) =>
      createDataplaneClient({
        baseUrl,
        authToken: cfg.dataplane.authToken!,
        rejectUnauthorized: cfg.dataplane.rejectUnauthorized,
      }),
    )
    return new AppContext({
      db,
      cfg,
      shutdown,
      dataplaneClients,
      ...overrides,
    })
  }
}

export type AppEvents = {
  [createMuteOpChannel]: []
  [createNotifOpChannel]: []
  [createOperationChannel]: []
}
