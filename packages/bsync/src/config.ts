import assert from 'node:assert'
import { envInt, envStr, envList, envBool } from '@atproto/common'

export const envToCfg = (env: ServerEnvironment): ServerConfig => {
  const serviceCfg: ServerConfig['service'] = {
    port: env.port ?? 2585,
    version: env.version ?? 'unknown',
    longPollTimeoutMs: env.longPollTimeoutMs ?? 10000,
  }

  assert(env.dbUrl, 'missing postgres url')
  const dbCfg: ServerConfig['db'] = {
    url: env.dbUrl,
    schema: env.dbSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
    migrate: env.dbMigrate,
  }

  assert(env.apiKeys.length > 0, 'missing api keys')
  const authCfg: ServerConfig['auth'] = {
    apiKeys: new Set(env.apiKeys),
  }

  let purchasesCfg: PurchasesConfig | undefined
  if (env.revenueCatV1ApiKey) {
    assert(env.revenueCatV1ApiUrl, 'missing RevenueCat V1 api url')
    assert(
      env.revenueCatWebhookAuthorization,
      'missing RevenueCat webhook authorization',
    )
    assert(
      env.stripePriceIdMonthly,
      'missing Stripe Price ID for monthly subscription',
    )
    assert(
      env.stripePriceIdAnnual,
      'missing Stripe Product ID for annual subscription',
    )
    assert(
      env.stripeProductIdMonthly,
      'missing Stripe Product ID for monthly subscription',
    )
    assert(
      env.stripeProductIdAnnual,
      'missing Stripe Product ID for annual subscription',
    )

    purchasesCfg = {
      revenueCatV1ApiKey: env.revenueCatV1ApiKey,
      revenueCatV1ApiUrl: env.revenueCatV1ApiUrl,
      revenueCatWebhookAuthorization: env.revenueCatWebhookAuthorization,
      stripePriceIdMonthly: env.stripePriceIdMonthly,
      stripePriceIdAnnual: env.stripePriceIdAnnual,
      stripeProductIdMonthly: env.stripeProductIdMonthly,
      stripeProductIdAnnual: env.stripeProductIdAnnual,
    }
  }

  return {
    service: serviceCfg,
    db: dbCfg,
    auth: authCfg,
    purchases: purchasesCfg,
  }
}

export type ServerConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  auth: AuthConfig
  purchases?: PurchasesConfig
}

type ServiceConfig = {
  port: number
  version?: string
  longPollTimeoutMs: number
}

type DatabaseConfig = {
  url: string
  schema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
  migrate?: boolean
}

type AuthConfig = {
  apiKeys: Set<string>
}

type PurchasesConfig = {
  revenueCatV1ApiKey: string
  revenueCatV1ApiUrl: string
  revenueCatWebhookAuthorization: string
  stripePriceIdMonthly: string
  stripePriceIdAnnual: string
  stripeProductIdMonthly: string
  stripeProductIdAnnual: string
}

export const readEnv = (): ServerEnvironment => {
  return {
    // service
    port: envInt('BSYNC_PORT'),
    version: envStr('BSYNC_VERSION'),
    longPollTimeoutMs: envInt('BSYNC_LONG_POLL_TIMEOUT_MS'),
    // database
    dbUrl: envStr('BSYNC_DB_POSTGRES_URL'),
    dbSchema: envStr('BSYNC_DB_POSTGRES_SCHEMA'),
    dbPoolSize: envInt('BSYNC_DB_POOL_SIZE'),
    dbPoolMaxUses: envInt('BSYNC_DB_POOL_MAX_USES'),
    dbPoolIdleTimeoutMs: envInt('BSYNC_DB_POOL_IDLE_TIMEOUT_MS'),
    dbMigrate: envBool('BSYNC_DB_MIGRATE'),
    // secrets
    apiKeys: envList('BSYNC_API_KEYS'),
    // purchases
    revenueCatV1ApiKey: envStr('BSYNC_REVENUE_CAT_V1_API_KEY'),
    revenueCatV1ApiUrl: envStr('BSYNC_REVENUE_CAT_V1_API_URL'),
    revenueCatWebhookAuthorization: envStr(
      'BSYNC_REVENUE_CAT_WEBHOOK_AUTHORIZATION',
    ),
    stripePriceIdMonthly: envStr('BSYNC_STRIPE_PRICE_ID_MONTHLY'),
    stripePriceIdAnnual: envStr('BSYNC_STRIPE_PRICE_ID_ANNUAL'),
    stripeProductIdMonthly: envStr('BSYNC_STRIPE_PRODUCT_ID_MONTHLY'),
    stripeProductIdAnnual: envStr('BSYNC_STRIPE_PRODUCT_ID_ANNUAL'),
  }
}

export type ServerEnvironment = {
  // service
  port?: number
  version?: string
  longPollTimeoutMs?: number
  // database
  dbUrl?: string
  dbSchema?: string
  dbPoolSize?: number
  dbPoolMaxUses?: number
  dbPoolIdleTimeoutMs?: number
  dbMigrate?: boolean
  // secrets
  apiKeys: string[]
  // purchases
  revenueCatV1ApiKey?: string
  revenueCatV1ApiUrl?: string
  revenueCatWebhookAuthorization?: string
  stripePriceIdMonthly?: string
  stripePriceIdAnnual?: string
  stripeProductIdMonthly?: string
  stripeProductIdAnnual?: string
}
