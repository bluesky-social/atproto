import { envInt, envStr, envBool, envList } from './util'

export const readEnv = (): ServerEnvironment => {
  return {
    port: envInt(process.env.PORT),
    hostname: envStr(process.env.HOSTNAME),
    serviceDid: envStr(process.env.SERVICE_DID),
    version: envStr(process.env.PDS_VERSION),
    privacyPolicyUrl: envStr(process.env.PRIVACY_POLICY_URL),
    termsOfServiceUrl: envStr(process.env.TERMS_OF_SERVICE_URL),
    dbSqliteLocation: envStr(process.env.DB_SQLITE_LOCATION),
    dbPostgresUrl: envStr(process.env.DB_POSTGRES_URL),
    dbPostgresMigrationUrl: envStr(process.env.DB_POSTGRES_MIGRATION_URL),
    dbPostgresSchema: envStr(process.env.DB_POSTGRES_SCHEMA),
    dbPostgresPoolSize: envInt(process.env.DB_POSTGRES_POOL_SIZE),
    dbPostgresPoolMaxUses: envInt(process.env.DB_POSTGRES_POOL_MAX_USES),
    dbPostgresPoolIdleTimeoutMs: envInt(
      process.env.DB_POSTGRES_POOL_IDLE_TIMEOUT_MS,
    ),
    blobstoreS3Bucket: envStr(process.env.BLOBSTORE_S3_BUCKET),
    blobstoreDiskLocation: envStr(process.env.BLOBSTORE_DISK_LOCATION),
    blobstoreDiskTmpLocation: envStr(process.env.BLOBSTORE_DISK_TMP_LOCATION),
    didPlcUrl: envStr(process.env.DID_PLC_URL),
    didCacheStaleTTL: envInt(process.env.DID_CACHE_STALE_TTL),
    didCacheMaxTTL: envInt(process.env.DID_CACHE_MAX_TTL),
    resolverTimeout: envInt(process.env.ID_RESOLVER_TIMEOUT),
    recoveryDidKey: envStr(process.env.RECOVERY_DID_KEY),
    handleDomains: envList(process.env.HANDLE_DOMAINS),
    inviteRequired: envBool(process.env.INVITE_REQUIRED),
    inviteInterval: envInt(process.env.INVITE_INTERVAL),
    emailSmtpUrl: envStr(process.env.EMAIL_SMTP_URL),
    emailFromAddress: envStr(process.env.EMAIL_FROM_ADDRESS),
    maxSubscriptionBuffer: envInt(process.env.MAX_SUBSCRIPTION_BUFFER),
    repoBackfillLimitMs: envInt(process.env.REPO_BACKFILL_LIMIT_MS),
    sequencerLeaderLockId: envInt(process.env.SEQUENCER_LEADER_LOCK_ID),
    bskyAppViewEndpoint: envStr(process.env.BSKY_APP_VIEW_ENDPOINT),
    bskyAppViewDid: envStr(process.env.BSKY_APP_VIEW_DID),
    crawlers: envList(process.env.CRAWLERS),
    jwtSecret: envStr(process.env.JWT_SECRET),
    adminPassword: envStr(process.env.ADMIN_PASSWORD),
    moderatorPassword: envStr(process.env.MODERATOR_PASSWORD),
    repoSigningKeyKmsKeyId: envStr(process.env.REPO_SIGNING_KEY_KMS_KEY_ID),
    repoSigningKeyK256PrivateKeyHex: envStr(
      process.env.REPO_SIGNING_KEY_K256_PRIVATE_KEY_HEX,
    ),
    plcRotationKeyKmsKeyId: envStr(process.env.PLC_ROTATION_KEY_KMS_KEY_ID),
    plcRotationKeyK256PrivateKeyHex: envStr(
      process.env.PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX,
    ),
  }
}

export type ServerEnvironment = {
  // infra
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
  handleDomains?: string[] // public hostname by default

  // accounts
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
  bskyAppViewEndpoint?: string
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
