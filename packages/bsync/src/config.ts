import assert from 'node:assert'
import { envBool, envInt, envList, envStr } from '@atproto/common'

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

  const dataplaneUrls = env.dataplaneUrls ?? []
  if (dataplaneUrls.length > 0) {
    assert(env.dataplaneAuthToken, 'missing dataplane auth token')
  }
  const dataplaneCfg: ServerConfig['dataplane'] = {
    urls: dataplaneUrls,
    authToken: env.dataplaneAuthToken,
    rejectUnauthorized: !env.dataplaneIgnoreBadTls,
  }

  return {
    service: serviceCfg,
    db: dbCfg,
    auth: authCfg,
    dataplane: dataplaneCfg,
  }
}

export type ServerConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  auth: AuthConfig
  dataplane: DataplaneConfig
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

type DataplaneConfig = {
  urls: string[]
  authToken?: string
  rejectUnauthorized: boolean
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
    dataplaneUrls: envList('BSYNC_DATAPLANE_URLS'),
    dataplaneAuthToken: envStr('BSYNC_DATAPLANE_AUTH_TOKEN'),
    dataplaneIgnoreBadTls: envBool('BSYNC_DATAPLANE_IGNORE_BAD_TLS'),
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
  dataplaneUrls?: string[]
  dataplaneAuthToken?: string
  dataplaneIgnoreBadTls?: boolean
}
