import { envInt, envStr } from '@atproto/common'

export const readEnv = (): OzoneEnvironment => {
  return {
    nodeEnv: envStr('NODE_ENV'),
    version: envStr('OZONE_VERSION'),
    port: envInt('OZONE_PORT'),
    publicUrl: envStr('OZONE_PUBLIC_URL'),
    serverDid: envStr('OZONE_SERVER_DID'),
    appviewUrl: envStr('OZONE_APPVIEW_URL'),
    appviewDid: envStr('OZONE_APPVIEW_DID'),
    pdsUrl: envStr('OZONE_PDS_URL'),
    pdsDid: envStr('OZONE_PDS_DID'),
    dbPostgresUrl: envStr('OZONE_DB_POSTGRES_URL'),
    dbPostgresSchema: envStr('OZONE_DB_POSTGRES_SCHEMA'),
    dbPoolSize: envInt('OZONE_DB_POOL_SIZE'),
    dbPoolMaxUses: envInt('OZONE_DB_POOL_MAX_USES'),
    dbPoolIdleTimeoutMs: envInt('OZONE_DB_POOL_IDLE_TIMEOUT_MS'),
    didPlcUrl: envStr('OZONE_DID_PLC_URL'),
    adminPassword: envStr('OZONE_ADMIN_PASSWORD'),
    moderatorPassword: envStr('OZONE_MODERATOR_PASSWORD'),
    triagePassword: envStr('OZONE_TRIAGE_PASSWORD'),
    signingKeyHex: envStr('OZONE_SIGNING_KEY_HEX'),
  }
}

export type OzoneEnvironment = {
  nodeEnv?: string
  version?: string
  port?: number
  publicUrl?: string
  serverDid?: string
  appviewUrl?: string
  appviewDid?: string
  pdsUrl?: string
  pdsDid?: string
  dbPostgresUrl?: string
  dbPostgresSchema?: string
  dbPoolSize?: number
  dbPoolMaxUses?: number
  dbPoolIdleTimeoutMs?: number
  didPlcUrl?: string
  adminPassword?: string
  moderatorPassword?: string
  triagePassword?: string
  signingKeyHex?: string
}
