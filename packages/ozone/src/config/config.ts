import assert from 'node:assert'
import { OzoneEnvironment } from './env'

// off-config but still from env:
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export const envToCfg = (env: OzoneEnvironment): OzoneConfig => {
  const port = env.port ?? 3000
  assert(env.publicUrl)
  assert(env.serverDid)
  const serviceCfg: OzoneConfig['service'] = {
    port,
    publicUrl: env.publicUrl,
    did: env.serverDid,
    version: env.version,
  }

  assert(env.dbPostgresUrl)
  const dbCfg: OzoneConfig['db'] = {
    postgresUrl: env.dbPostgresUrl,
    postgresSchema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  }

  assert(env.appviewUrl)
  assert(env.appviewDid)
  const appviewCfg: OzoneConfig['appview'] = {
    url: env.appviewUrl,
    did: env.appviewDid,
  }

  assert(env.pdsUrl)
  assert(env.pdsDid)
  const pdsCfg: OzoneConfig['pds'] = {
    url: env.pdsUrl,
    did: env.pdsDid,
  }

  assert(env.didPlcUrl)
  const identityCfg: OzoneConfig['identity'] = {
    plcUrl: env.didPlcUrl,
  }

  return {
    service: serviceCfg,
    db: dbCfg,
    appview: appviewCfg,
    pds: pdsCfg,
    identity: identityCfg,
  }
}

export type OzoneConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  appview: AppviewConfig
  pds: PdsConfig | null
  identity: IdentityConfig
}

export type ServiceConfig = {
  port: number
  publicUrl: string
  did: string
  version?: string
}

export type DatabaseConfig = {
  postgresUrl: string
  postgresSchema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
}

export type AppviewConfig = {
  url: string
  did: string
}

export type PdsConfig = {
  url: string
  did: string
}

export type IdentityConfig = {
  plcUrl: string
}
