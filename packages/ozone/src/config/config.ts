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
    devMode: env.devMode,
  }

  assert(env.dbPostgresUrl)
  const dbCfg: OzoneConfig['db'] = {
    postgresUrl: env.dbPostgresUrl,
    postgresSchema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
  }

  assert(env.appviewUrl && env.appviewDid)
  const appviewCfg: OzoneConfig['appview'] = {
    url: env.appviewUrl,
    did: env.appviewDid,
    pushEvents: !!env.appviewPushEvents,
  }

  let pdsCfg: OzoneConfig['pds'] = null
  if (env.pdsUrl || env.pdsDid) {
    assert(env.pdsUrl && env.pdsDid)
    pdsCfg = {
      url: env.pdsUrl,
      did: env.pdsDid,
    }
  }

  const cdnCfg: OzoneConfig['cdn'] = {
    paths: env.cdnPaths,
  }

  assert(env.didPlcUrl)
  const identityCfg: OzoneConfig['identity'] = {
    plcUrl: env.didPlcUrl,
  }

  const blobDivertServiceCfg =
    env.blobDivertUrl && env.blobDivertAdminPassword
      ? {
          url: env.blobDivertUrl,
          adminPassword: env.blobDivertAdminPassword,
        }
      : null
  const accessCfg: OzoneConfig['access'] = {
    admins: env.adminDids,
    moderators: env.moderatorDids,
    triage: env.triageDids,
  }

  return {
    service: serviceCfg,
    db: dbCfg,
    appview: appviewCfg,
    pds: pdsCfg,
    cdn: cdnCfg,
    identity: identityCfg,
    blobDivert: blobDivertServiceCfg,
    access: accessCfg,
  }
}

export type OzoneConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  appview: AppviewConfig
  pds: PdsConfig | null
  cdn: CdnConfig
  identity: IdentityConfig
  blobDivert: BlobDivertConfig | null
  access: AccessConfig
}

export type ServiceConfig = {
  port: number
  publicUrl: string
  did: string
  version?: string
  devMode?: boolean
}

export type BlobDivertConfig = {
  url: string
  adminPassword: string
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
  pushEvents: boolean
}

export type PdsConfig = {
  url: string
  did: string
}

export type CdnConfig = {
  paths?: string[]
}

export type IdentityConfig = {
  plcUrl: string
}

export type AccessConfig = {
  admins: string[]
  moderators: string[]
  triage: string[]
}
