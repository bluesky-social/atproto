import assert from 'node:assert'
import { DAY, HOUR, MINUTE } from '@atproto/common'
import type { DidString, UriString } from '@atproto/lex'
import type { OzoneEnvironment } from './env.js'

// off-config but still from env:
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export const envToCfg = (env: OzoneEnvironment): OzoneConfig => {
  const port = env.port ?? 3000
  assert(env.publicUrl, 'publicUrl is required')
  assert(env.serverDid, 'serverDid is required')
  const serviceCfg: OzoneConfig['service'] = {
    port,
    publicUrl: env.publicUrl,
    did: env.serverDid as DidString,
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
    materializedViewRefreshTimeoutMs: env.dbMaterializedViewRefreshTimeoutMs,
    teamProfileRefreshIntervalMs: env.dbTeamProfileRefreshIntervalMs,
  }

  assert(env.appviewUrl, 'appviewUrl is required')
  assert(env.appviewDid, 'appviewDid is required')
  const appviewCfg: OzoneConfig['appview'] = {
    url: env.appviewUrl as UriString,
    did: env.appviewDid as DidString,
    pushEvents: !!env.appviewPushEvents,
  }

  let pdsCfg: OzoneConfig['pds'] = null
  if (env.pdsUrl || env.pdsDid) {
    assert(env.pdsUrl, 'pdsUrl is required')
    assert(env.pdsDid, 'pdsDid is required')
    pdsCfg = {
      url: env.pdsUrl as UriString,
      did: env.pdsDid as DidString,
    }
  }

  let chatCfg: OzoneConfig['chat'] = null
  if (env.chatUrl || env.chatDid) {
    assert(env.chatUrl, 'chatUrl is required when chatDid is provided')
    assert(env.chatDid, 'chatDid is required when chatUrl is provided')
    chatCfg = {
      url: env.chatUrl as UriString,
      did: env.chatDid as DidString,
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
          url: env.blobDivertUrl as UriString,
          adminPassword: env.blobDivertAdminPassword,
        }
      : null
  const accessCfg: OzoneConfig['access'] = {
    admins: env.adminDids as DidString[],
    moderators: env.moderatorDids as DidString[],
    triage: env.triageDids as DidString[],
  }
  const verifierCfg: OzoneConfig['verifier'] =
    env.verifierUrl && env.verifierDid && env.verifierPassword
      ? {
          url: env.verifierUrl as UriString,
          did: env.verifierDid as DidString,
          password: env.verifierPassword,
          issuersToIndex: env.verifierIssuersToIndex,
        }
      : null

  const assignmentsCfg: OzoneConfig['assignments'] = {
    queueDurationMs: env.assignmentQueueDurationMs ?? 5 * MINUTE,
    reportDurationMs: env.assignmentReportDurationMs ?? 5 * MINUTE,
  }

  const statsCfg: OzoneConfig['stats'] = {
    computerIntervalMinutes: env.statsComputerIntervalMinutes ?? 15,
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
    verifier: verifierCfg,
    assignments: assignmentsCfg,
    stats: statsCfg,
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
  assignments: AssignmentsConfig
  stats: StatsConfig
  jetstreamUrl?: string
  verifier: VerifierConfig | null
}

export type StatsConfig = {
  /**
   * Minutes between stats computer cycles.
   * Defaults to 15. Minimum is 1.
   * Set to -1 to disable the stats computer.
   */
  computerIntervalMinutes: number
}

export type ServiceConfig = {
  port: number
  publicUrl: string
  did: DidString
  version?: string
  devMode?: boolean
  serviceRecordCacheTTL: number // in ms, default 5 mins
}

export type BlobDivertConfig = {
  url: UriString
  adminPassword: string
}

export type DatabaseConfig = {
  postgresUrl: string
  postgresSchema?: string
  poolSize?: number
  poolMaxUses?: number
  poolIdleTimeoutMs?: number
  materializedViewRefreshIntervalMs?: number
  materializedViewRefreshTimeoutMs?: number
  teamProfileRefreshIntervalMs?: number
}

export type AppviewConfig = {
  url: UriString
  did: DidString
  pushEvents: boolean
}

export type PdsConfig = {
  url: UriString
  did: DidString
}

export type ChatConfig = {
  url: UriString
  did: DidString
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
  admins: DidString[]
  moderators: DidString[]
  triage: DidString[]
}

export type VerifierConfig = {
  url: UriString
  did: DidString
  password: string
  jetstreamUrl?: string
  issuersToIndex?: string[]
}

export type AssignmentsConfig = {
  queueDurationMs: number
  reportDurationMs: number
}
