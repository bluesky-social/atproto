import { envBool, envInt, envList, envStr } from '@atproto/common'

export const readEnv = (): OzoneEnvironment => {
  return {
    nodeEnv: envStr('NODE_ENV'),
    devMode: envBool('OZONE_DEV_MODE'),
    version: envStr('OZONE_VERSION'),
    port: envInt('OZONE_PORT'),
    publicUrl: envStr('OZONE_PUBLIC_URL'),
    serverDid: envStr('OZONE_SERVER_DID'),
    appviewUrl: envStr('OZONE_APPVIEW_URL'),
    appviewDid: envStr('OZONE_APPVIEW_DID'),
    appviewPushEvents: envBool('OZONE_APPVIEW_PUSH_EVENTS'),
    pdsUrl: envStr('OZONE_PDS_URL'),
    pdsDid: envStr('OZONE_PDS_DID'),
    chatUrl: envStr('OZONE_CHAT_URL'),
    chatDid: envStr('OZONE_CHAT_DID'),
    dbPostgresUrl: envStr('OZONE_DB_POSTGRES_URL'),
    dbPostgresSchema: envStr('OZONE_DB_POSTGRES_SCHEMA'),
    dbPoolSize: envInt('OZONE_DB_POOL_SIZE'),
    dbPoolMaxUses: envInt('OZONE_DB_POOL_MAX_USES'),
    dbPoolIdleTimeoutMs: envInt('OZONE_DB_POOL_IDLE_TIMEOUT_MS'),
    didPlcUrl: envStr('OZONE_DID_PLC_URL'),
    didCacheStaleTTL: envInt('OZONE_DID_CACHE_STALE_TTL'),
    didCacheMaxTTL: envInt('OZONE_DID_CACHE_MAX_TTL'),
    cdnPaths: envList('OZONE_CDN_PATHS'),
    adminDids: envList('OZONE_ADMIN_DIDS'),
    moderatorDids: envList('OZONE_MODERATOR_DIDS'),
    triageDids: envList('OZONE_TRIAGE_DIDS'),
    adminPassword: envStr('OZONE_ADMIN_PASSWORD'),
    signingKeyHex: envStr('OZONE_SIGNING_KEY_HEX'),
    blobDivertUrl: envStr('OZONE_BLOB_DIVERT_URL'),
    blobDivertAdminPassword: envStr('OZONE_BLOB_DIVERT_ADMIN_PASSWORD'),
  }
}

export type OzoneEnvironment = {
  nodeEnv?: string
  devMode?: boolean
  version?: string
  port?: number
  publicUrl?: string
  serverDid?: string
  appviewUrl?: string
  appviewDid?: string
  appviewPushEvents?: boolean
  pdsUrl?: string
  pdsDid?: string
  chatUrl?: string
  chatDid?: string
  dbPostgresUrl?: string
  dbPostgresSchema?: string
  dbPoolSize?: number
  dbPoolMaxUses?: number
  dbPoolIdleTimeoutMs?: number
  didPlcUrl?: string
  didCacheStaleTTL?: number
  didCacheMaxTTL?: number
  cdnPaths?: string[]
  adminDids: string[]
  moderatorDids: string[]
  triageDids: string[]
  adminPassword?: string
  signingKeyHex?: string
  blobDivertUrl?: string
  blobDivertAdminPassword?: string
}
