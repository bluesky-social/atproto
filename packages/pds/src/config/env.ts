import { envInt, envStr, envBool, envList } from './util'

export const readEnv = (): ServerEnvironment => {
  return {
    // service
    port: envInt(process.env.PDS_PORT),
    hostname: envStr(process.env.PDS_HOSTNAME),
    serviceDid: envStr(process.env.PDS_SERVICE_DID),
    version: envStr(process.env.PDS_VERSION),
    privacyPolicyUrl: envStr(process.env.PDS_PRIVACY_POLICY_URL),
    termsOfServiceUrl: envStr(process.env.PDS_TERMS_OF_SERVICE_URL),

    // db: one required
    // sqlite
    dbSqliteLocation: envStr(process.env.PDS_DB_SQLITE_LOCATION),
    // postgres
    dbPostgresUrl: envStr(process.env.PDS_DB_POSTGRES_URL),
    dbPostgresMigrationUrl: envStr(process.env.PDS_DB_POSTGRES_MIGRATION_URL),
    dbPostgresSchema: envStr(process.env.PDS_DB_POSTGRES_SCHEMA),
    dbPostgresPoolSize: envInt(process.env.PDS_DB_POSTGRES_POOL_SIZE),
    dbPostgresPoolMaxUses: envInt(process.env.PDS_DB_POSTGRES_POOL_MAX_USES),
    dbPostgresPoolIdleTimeoutMs: envInt(
      process.env.PDS_DB_POSTGRES_POOL_IDLE_TIMEOUT_MS,
    ),

    // blobstore: one required
    // s3
    blobstoreS3Bucket: envStr(process.env.PDS_BLOBSTORE_S3_BUCKET),
    // disk
    blobstoreDiskLocation: envStr(process.env.PDS_BLOBSTORE_DISK_LOCATION),
    blobstoreDiskTmpLocation: envStr(
      process.env.PDS_BLOBSTORE_DISK_TMP_LOCATION,
    ),

    // identity
    didPlcUrl: envStr(process.env.PDS_DID_PLC_URL),
    didCacheStaleTTL: envInt(process.env.PDS_DID_CACHE_STALE_TTL),
    didCacheMaxTTL: envInt(process.env.PDS_DID_CACHE_MAX_TTL),
    resolverTimeout: envInt(process.env.PDS_ID_RESOLVER_TIMEOUT),
    recoveryDidKey: envStr(process.env.PDS_RECOVERY_DID_KEY),
    serviceHandleDomains: envList(process.env.PDS_SERVICE_HANDLE_DOMAINS),

    // invites
    inviteRequired: envBool(process.env.PDS_INVITE_REQUIRED),
    inviteInterval: envInt(process.env.PDS_INVITE_INTERVAL),

    // email
    emailSmtpUrl: envStr(process.env.PDS_EMAIL_SMTP_URL),
    emailFromAddress: envStr(process.env.PDS_EMAIL_FROM_ADDRESS),

    // subscription
    maxSubscriptionBuffer: envInt(process.env.PDS_MAX_SUBSCRIPTION_BUFFER),
    repoBackfillLimitMs: envInt(process.env.PDS_REPO_BACKFILL_LIMIT_MS),
    sequencerLeaderLockId: envInt(process.env.PDS_SEQUENCER_LEADER_LOCK_ID),

    // appview
    bskyAppViewUrl: envStr(process.env.PDS_BSKY_APP_VIEW_URL),
    bskyAppViewDid: envStr(process.env.PDS_BSKY_APP_VIEW_DID),

    // crawlers
    crawlers: envList(process.env.PDS_CRAWLERS),

    // secrets
    jwtSecret: envStr(process.env.PDS_JWT_SECRET),
    adminPassword: envStr(process.env.PDS_ADMIN_PASSWORD),
    moderatorPassword: envStr(process.env.PDS_MODERATOR_PASSWORD),

    // keys: only one of each required
    // kms
    repoSigningKeyKmsKeyId: envStr(process.env.PDS_REPO_SIGNING_KEY_KMS_KEY_ID),
    // memory
    repoSigningKeyK256PrivateKeyHex: envStr(
      process.env.PDS_REPO_SIGNING_KEY_K256_PRIVATE_KEY_HEX,
    ),
    // kms
    plcRotationKeyKmsKeyId: envStr(process.env.PDS_PLC_ROTATION_KEY_KMS_KEY_ID),
    // memory
    plcRotationKeyK256PrivateKeyHex: envStr(
      process.env.PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX,
    ),
  }
}

export type ServerEnvironment = {
  // service
  port?: number
  hostname?: string
  serviceDid?: string
  version?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string

  // db: one required
  dbSqliteLocation?: string
  dbPostgresUrl?: string
  dbPostgresMigrationUrl?: string
  dbPostgresSchema?: string
  dbPostgresPoolSize?: number
  dbPostgresPoolMaxUses?: number
  dbPostgresPoolIdleTimeoutMs?: number

  // blobstore: one required
  blobstoreS3Bucket?: string
  blobstoreDiskLocation?: string
  blobstoreDiskTmpLocation?: string

  // identity
  didPlcUrl?: string
  didCacheStaleTTL?: number
  didCacheMaxTTL?: number
  resolverTimeout?: number
  recoveryDidKey?: string
  serviceHandleDomains?: string[] // public hostname by default

  // invites
  inviteRequired?: boolean
  inviteInterval?: number

  // email
  emailSmtpUrl?: string
  emailFromAddress?: string

  // subscription
  maxSubscriptionBuffer?: number
  repoBackfillLimitMs?: number
  sequencerLeaderLockId?: number

  // appview
  bskyAppViewUrl?: string
  bskyAppViewDid?: string

  // crawler
  crawlers?: string[]

  // secrets
  jwtSecret?: string
  adminPassword?: string
  moderatorPassword?: string

  // keys
  repoSigningKeyKmsKeyId?: string
  repoSigningKeyK256PrivateKeyHex?: string
  plcRotationKeyKmsKeyId?: string
  plcRotationKeyK256PrivateKeyHex?: string
}
