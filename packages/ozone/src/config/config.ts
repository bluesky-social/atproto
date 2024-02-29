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

  const blobReportServiceCfg = {
    url: env.blobReportServiceUrl,
    authToken: env.blobReportServiceAuthToken,
  }

  return {
    service: serviceCfg,
    db: dbCfg,
    appview: appviewCfg,
    pds: pdsCfg,
    identity: identityCfg,
    blobReportService: blobReportServiceCfg,
  }
}

export type OzoneConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  appview: AppviewConfig
  pds: PdsConfig | null
  identity: IdentityConfig
  blobReportService: BlobReportServiceConfig
}

export type ServiceConfig = {
  port: number
  publicUrl: string
  did: string
  version?: string
}

export type BlobReportServiceConfig = {
  url?: string
  authToken?: string
}

export type DatabaseConfig = {
  postgresUrl: string
  postgresSchema?: string
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
