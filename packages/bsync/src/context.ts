import TypedEventEmitter from 'typed-emitter'
import { ServerConfig } from './config'
import Database from './db'
import { createMuteOpChannel } from './db/schema/mute_op'
import { createNotifOpChannel } from './db/schema/notif_op'
import { EventEmitter } from 'stream'
import { createPurchaseOpChannel } from './db/schema/purchase_op'
import { PurchasesClient } from './purchases'

export type AppContextOptions = {
  db: Database
  purchasesClient: PurchasesClient | undefined
  cfg: ServerConfig
  shutdown: AbortSignal
}

export class AppContext {
  db: Database
  purchasesClient: PurchasesClient | undefined
  cfg: ServerConfig
  shutdown: AbortSignal
  events: TypedEventEmitter<AppEvents>

  constructor(opts: AppContextOptions) {
    this.db = opts.db
    this.purchasesClient = opts.purchasesClient
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

    let purchasesClient: PurchasesClient | undefined
    if (cfg.purchases) {
      purchasesClient = new PurchasesClient({
        revenueCatV1ApiKey: cfg.purchases.revenueCatV1ApiKey,
        revenueCatV1ApiUrl: cfg.purchases.revenueCatV1ApiUrl,
        revenueCatWebhookAuthorization:
          cfg.purchases.revenueCatWebhookAuthorization,
        stripePriceIdMonthly: cfg.purchases.stripePriceIdMonthly,
        stripePriceIdAnnual: cfg.purchases.stripePriceIdAnnual,
        stripeProductIdMonthly: cfg.purchases.stripeProductIdMonthly,
        stripeProductIdAnnual: cfg.purchases.stripeProductIdAnnual,
      })
    }

    return new AppContext({
      db,
      purchasesClient,
      cfg,
      shutdown,
      ...overrides,
    })
  }
}

export default AppContext

export type AppEvents = {
  [createMuteOpChannel]: () => void
  [createNotifOpChannel]: () => void
  [createPurchaseOpChannel]: () => void
}
