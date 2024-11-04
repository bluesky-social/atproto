import assert from 'node:assert'
import { OzoneEnvironment } from './env'
import { DAY, HOUR } from '@atproto/common'

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
  }

  assert(env.dbPostgresUrl, 'dbPostgresUrl is required')
  const dbCfg: OzoneConfig['db'] = {
    postgresUrl: env.dbPostgresUrl,
    postgresSchema: env.dbPostgresSchema,
    poolSize: env.dbPoolSize,
    poolMaxUses: env.dbPoolMaxUses,
    poolIdleTimeoutMs: env.dbPoolIdleTimeoutMs,
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
