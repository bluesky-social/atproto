import { envBool, envInt, envList, envStr } from '@atproto/common'
import type { DidString, UriString } from '@atproto/lex'

export const readEnv = (): OzoneEnvironment => {
  return {
    nodeEnv: envStr('NODE_ENV'),
    devMode: envBool('OZONE_DEV_MODE'),
    version: envStr('OZONE_VERSION'),
    port: envInt('OZONE_PORT'),
    metricsPort: envInt('OZONE_METRICS_PORT'),
    daemonMetricsPort: envInt('OZONE_DAEMON_METRICS_PORT'),
    publicUrl: envStr('OZONE_PUBLIC_URL') as UriString,
    serverDid: envStr('OZONE_SERVER_DID') as DidString,
    serviceRecordCacheTTL: envInt('OZONE_SERVICE_RECORD_CACHE_TTL'),
    appviewUrl: envStr('OZONE_APPVIEW_URL') as UriString,
    appviewDid: envStr('OZONE_APPVIEW_DID') as DidString,
    appviewPushEvents: envBool('OZONE_APPVIEW_PUSH_EVENTS'),
    pdsUrl: envStr('OZONE_PDS_URL') as UriString,
    pdsDid: envStr('OZONE_PDS_DID') as DidString,
    chatUrl: envStr('OZONE_CHAT_URL') as UriString,
    chatDid: envStr('OZONE_CHAT_DID') as DidString,
    dbPostgresUrl: envStr('OZONE_DB_POSTGRES_URL'),
    dbPostgresSchema: envStr('OZONE_DB_POSTGRES_SCHEMA'),
    dbPoolSize: envInt('OZONE_DB_POOL_SIZE'),
    dbPoolMaxUses: envInt('OZONE_DB_POOL_MAX_USES'),
    dbPoolIdleTimeoutMs: envInt('OZONE_DB_POOL_IDLE_TIMEOUT_MS'),
    dbMaterializedViewRefreshIntervalMs: envInt(
      'OZONE_DB_MATERIALIZED_VIEW_REFRESH_INTERVAL_MS',
    ),
    dbMaterializedViewRefreshTimeoutMs: envInt(
      'OZONE_DB_MATERIALIZED_VIEW_REFRESH_TIMEOUT_MS',
    ),
    dbTeamProfileRefreshIntervalMs: envInt(
      'OZONE_DB_TEAM_PROFILE_REFRESH_INTERVAL_MS',
    ),
    didPlcUrl: envStr('OZONE_DID_PLC_URL'),
    didCacheStaleTTL: envInt('OZONE_DID_CACHE_STALE_TTL'),
    didCacheMaxTTL: envInt('OZONE_DID_CACHE_MAX_TTL'),
    cdnPaths: envList('OZONE_CDN_PATHS'),
    adminDids: envList('OZONE_ADMIN_DIDS') as DidString[],
    moderatorDids: envList('OZONE_MODERATOR_DIDS') as DidString[],
    triageDids: envList('OZONE_TRIAGE_DIDS') as DidString[],
    adminPassword: envStr('OZONE_ADMIN_PASSWORD'),
    signingKeyHex: envStr('OZONE_SIGNING_KEY_HEX'),
    pdsHeaders: envList('OZONE_PDS_HEADERS'),
    blobDivertUrl: envStr('OZONE_BLOB_DIVERT_URL') as UriString,
    blobDivertAdminPassword: envStr('OZONE_BLOB_DIVERT_ADMIN_PASSWORD'),
    verifierUrl: envStr('OZONE_VERIFIER_URL') as UriString,
    verifierDid: envStr('OZONE_VERIFIER_DID') as DidString,
    verifierPassword: envStr('OZONE_VERIFIER_PASSWORD'),
    verifierIssuersToIndex: envList('OZONE_VERIFIER_ISSUERS_TO_INDEX'),
    jetstreamUrl: envStr('OZONE_JETSTREAM_URL'),
    assignmentQueueDurationMs: envInt('OZONE_ASSIGNMENT_QUEUE_DURATION_MS'),
    assignmentReportDurationMs: envInt('OZONE_ASSIGNMENT_REPORT_DURATION_MS'),
    statsComputerIntervalMinutes: envInt(
      'OZONE_STATS_COMPUTER_INTERVAL_MINUTES',
    ),
  }
}

export type OzoneEnvironment = {
  nodeEnv?: string
  devMode?: boolean
  version?: string
  port?: number
  metricsPort?: number
  daemonMetricsPort?: number
  publicUrl?: string
  serverDid?: DidString
  serviceRecordCacheTTL?: number
  appviewUrl?: UriString
  appviewDid?: DidString
  appviewPushEvents?: boolean
  pdsUrl?: UriString
  pdsDid?: DidString
  chatUrl?: UriString
  chatDid?: DidString
  dbPostgresUrl?: string
  dbPostgresSchema?: string
  dbPoolSize?: number
  dbPoolMaxUses?: number
  dbPoolIdleTimeoutMs?: number
  dbMaterializedViewRefreshIntervalMs?: number
  dbMaterializedViewRefreshTimeoutMs?: number
  dbTeamProfileRefreshIntervalMs?: number
  didPlcUrl?: string
  didCacheStaleTTL?: number
  didCacheMaxTTL?: number
  cdnPaths?: string[]
  adminDids: DidString[]
  moderatorDids: DidString[]
  triageDids: DidString[]
  adminPassword?: string
  signingKeyHex?: string
  pdsHeaders?: string[]
  blobDivertUrl?: UriString
  blobDivertAdminPassword?: string
  verifierUrl?: UriString
  verifierDid?: DidString
  verifierPassword?: string
  verifierIssuersToIndex?: string[]
  jetstreamUrl?: string
  assignmentQueueDurationMs?: number
  assignmentReportDurationMs?: number
  statsComputerIntervalMinutes?: number
}
