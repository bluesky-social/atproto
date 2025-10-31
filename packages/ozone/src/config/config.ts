import assert from 'node:assert'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import { OzoneEnvironment } from './env'

// off-config but still from env:
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export const envToCfg = (env: OzoneEnvironment): OzoneConfig => {
  const port = env.port ?? 3000
  assert(env.publicUrl, 'publicUrl is required')
  assert(env.serverDid, 'serverDid is required')
  const serviceCfg: OzoneConfig['service'] = {
    port,
    publicUrl: env.publicUrl,
    did: env.serverDid,
    version: env.version,
    devMode: env.devMode,
    serviceRecordCacheTTL: env.serviceRecordCacheTTL ?? 5 * MINUTE, // default 5 mins
  }

  assert(env.dbPostgresUrl, 'dbPostgresUrl is required')
  const dbCfg: OzoneConfig['db'] = {
    postgresUrl: env.dbPostgresUrl,
    postgresSchema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
    materializedViewRefreshIntervalMs: env.dbMaterializedViewRefreshIntervalMs,
    teamProfileRefreshIntervalMs: env.dbTeamProfileRefreshIntervalMs,
  }

  assert(env.appviewUrl, 'appviewUrl is required')
  assert(env.appviewDid, 'appviewDid is required')
  const appviewCfg: OzoneConfig['appview'] = {
    url: env.appviewUrl,
    did: env.appviewDid,
    pushEvents: !!env.appviewPushEvents,
  }

  let pdsCfg: OzoneConfig['pds'] = null
  if (env.pdsUrl || env.pdsDid) {
    assert(env.pdsUrl, 'pdsUrl is required')
    assert(env.pdsDid, 'pdsDid is required')
    pdsCfg = {
      url: env.pdsUrl,
      did: env.pdsDid,
    }
  }

  let chatCfg: OzoneConfig['chat'] = null
  if (env.chatUrl || env.chatDid) {
    assert(env.chatUrl, 'chatUrl is required when chatDid is provided')
    assert(env.chatDid, 'chatDid is required when chatUrl is provided')
    chatCfg = {
      url: env.chatUrl,
      did: env.chatDid,
    }
  }

  const cdnCfg: OzoneConfig['cdn'] = {
    paths: env.cdnPaths,
  }

  assert(env.didPlcUrl, 'didPlcUrl is required')
  const identityCfg: OzoneConfig['identity'] = {
    plcUrl: env.didPlcUrl,
    cacheMaxTTL: env.didCacheMaxTTL ?? DAY,
    cacheStaleTTL: env.didCacheStaleTTL ?? HOUR,
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
  const verifierCfg: OzoneConfig['verifier'] =
    env.verifierUrl && env.verifierDid && env.verifierPassword
      ? {
          url: env.verifierUrl,
          did: env.verifierDid,
          password: env.verifierPassword,
          issuersToIndex: env.verifierIssuersToIndex,
        }
      : null

  return {
    service: serviceCfg,
    db: dbCfg,
    appview: appviewCfg,
    pds: pdsCfg,
    chat: chatCfg,
    cdn: cdnCfg,
    identity: identityCfg,
    blobDivert: blobDivertServiceCfg,
    access: accessCfg,
    verifier: verifierCfg,
    jetstreamUrl: env.jetstreamUrl,
  }
}

export type OzoneConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  appview: AppviewConfig
  pds: PdsConfig | null
  chat: ChatConfig | null
  cdn: CdnConfig
  identity: IdentityConfig
  blobDivert: BlobDivertConfig | null
  access: AccessConfig
  jetstreamUrl?: string
  verifier: VerifierConfig | null
}

export type ServiceConfig = {
  port: number
  publicUrl: string
  did: string
  version?: string
  devMode?: boolean
  serviceRecordCacheTTL: number // in ms, default 5 mins
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
  materializedViewRefreshIntervalMs?: number
  teamProfileRefreshIntervalMs?: number
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

export type ChatConfig = {
  url: string
  did: string
}

export type CdnConfig = {
  paths?: string[]
}

export type IdentityConfig = {
  plcUrl: string
  cacheStaleTTL: number
  cacheMaxTTL: number
}

export type AccessConfig = {
  admins: string[]
  moderators: string[]
  triage: string[]
}

export type VerifierConfig = {
  url: string
  did: string
  password: string
  jetstreamUrl?: string
  issuersToIndex?: string[]
}
