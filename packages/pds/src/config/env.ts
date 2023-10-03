import { envInt, envStr, envBool, envList } from './util'

export const readEnv = (): ServerEnvironment => {
  return {
    // service
    port: envInt('PDS_PORT'),
    hostname: envStr('PDS_HOSTNAME'),
    serviceDid: envStr('PDS_SERVICE_DID'),
    version: envStr('PDS_VERSION'),
    privacyPolicyUrl: envStr('PDS_PRIVACY_POLICY_URL'),
    termsOfServiceUrl: envStr('PDS_TERMS_OF_SERVICE_URL'),

    // db: one required
    // sqlite
    dbSqliteLocation: envStr('PDS_DB_SQLITE_LOCATION'),
    // postgres
    dbPostgresUrl: envStr('PDS_DB_POSTGRES_URL'),
    dbPostgresMigrationUrl: envStr('PDS_DB_POSTGRES_MIGRATION_URL'),
    dbPostgresSchema: envStr('PDS_DB_POSTGRES_SCHEMA'),
    dbPostgresPoolSize: envInt('PDS_DB_POSTGRES_POOL_SIZE'),
    dbPostgresPoolMaxUses: envInt('PDS_DB_POSTGRES_POOL_MAX_USES'),
    dbPostgresPoolIdleTimeoutMs: envInt('PDS_DB_POSTGRES_POOL_IDLE_TIMEOUT_MS'),

    // blobstore: one required
    // s3
    blobstoreS3Bucket: envStr('PDS_BLOBSTORE_S3_BUCKET'),
    // disk
    blobstoreDiskLocation: envStr('PDS_BLOBSTORE_DISK_LOCATION'),
    blobstoreDiskTmpLocation: envStr('PDS_BLOBSTORE_DISK_TMP_LOCATION'),

    // identity
    didPlcUrl: envStr('PDS_DID_PLC_URL'),
    didCacheStaleTTL: envInt('PDS_DID_CACHE_STALE_TTL'),
    didCacheMaxTTL: envInt('PDS_DID_CACHE_MAX_TTL'),
    resolverTimeout: envInt('PDS_ID_RESOLVER_TIMEOUT'),
    recoveryDidKey: envStr('PDS_RECOVERY_DID_KEY'),
    serviceHandleDomains: envList('PDS_SERVICE_HANDLE_DOMAINS'),
    handleBackupNameservers: envList('PDS_HANDLE_BACKUP_NAMESERVERS'),

    // invites
    inviteRequired: envBool('PDS_INVITE_REQUIRED'),
    inviteInterval: envInt('PDS_INVITE_INTERVAL'),
    inviteEpoch: envInt('PDS_INVITE_EPOCH'),

    // email
    emailSmtpUrl: envStr('PDS_EMAIL_SMTP_URL'),
    emailFromAddress: envStr('PDS_EMAIL_FROM_ADDRESS'),
    moderationEmailSmtpUrl: envStr('PDS_MODERATION_EMAIL_SMTP_URL'),
    moderationEmailAddress: envStr('PDS_MODERATION_EMAIL_ADDRESS'),

    // subscription
    maxSubscriptionBuffer: envInt('PDS_MAX_SUBSCRIPTION_BUFFER'),
    repoBackfillLimitMs: envInt('PDS_REPO_BACKFILL_LIMIT_MS'),
    sequencerLeaderEnabled: envBool('PDS_SEQUENCER_LEADER_ENABLED'),
    sequencerLeaderLockId: envInt('PDS_SEQUENCER_LEADER_LOCK_ID'),

    // appview
    bskyAppViewUrl: envStr('PDS_BSKY_APP_VIEW_URL'),
    bskyAppViewDid: envStr('PDS_BSKY_APP_VIEW_DID'),
    bskyAppViewModeration: envBool('PDS_BSKY_APP_VIEW_MODERATION'),
    bskyAppViewCdnUrlPattern: envStr('PDS_BSKY_APP_VIEW_CDN_URL_PATTERN'),

    // rate limits
    rateLimitsEnabled: envBool('PDS_RATE_LIMITS_ENABLED'),
    rateLimitBypassKey: envStr('PDS_RATE_LIMIT_BYPASS_KEY'),
    rateLimitBypassIps: envList('PDS_RATE_LIMIT_BYPASS_IPS'),

    // redis
    redisScratchAddress: envStr('PDS_REDIS_SCRATCH_ADDRESS'),
    redisScratchPassword: envStr('PDS_REDIS_SCRATCH_PASSWORD'),

    // crawlers
    crawlers: envList('PDS_CRAWLERS'),

    // secrets
    jwtSecret: envStr('PDS_JWT_SECRET'),
    adminPassword: envStr('PDS_ADMIN_PASSWORD'),
    moderatorPassword: envStr('PDS_MODERATOR_PASSWORD'),
    triagePassword: envStr('PDS_TRIAGE_PASSWORD'),

    // keys: only one of each required
    // kms
    repoSigningKeyKmsKeyId: envStr('PDS_REPO_SIGNING_KEY_KMS_KEY_ID'),
    // memory
    repoSigningKeyK256PrivateKeyHex: envStr(
      'PDS_REPO_SIGNING_KEY_K256_PRIVATE_KEY_HEX',
    ),
    // kms
    plcRotationKeyKmsKeyId: envStr('PDS_PLC_ROTATION_KEY_KMS_KEY_ID'),
    // memory
    plcRotationKeyK256PrivateKeyHex: envStr(
      'PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX',
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
  handleBackupNameservers?: string[]

  // invites
  inviteRequired?: boolean
  inviteInterval?: number
  inviteEpoch?: number

  // email
  emailSmtpUrl?: string
  emailFromAddress?: string
  moderationEmailSmtpUrl?: string
  moderationEmailAddress?: string

  // subscription
  maxSubscriptionBuffer?: number
  repoBackfillLimitMs?: number
  sequencerLeaderEnabled?: boolean
  sequencerLeaderLockId?: number

  // appview
  bskyAppViewUrl?: string
  bskyAppViewDid?: string
  bskyAppViewModeration?: boolean
  bskyAppViewCdnUrlPattern?: string

  // rate limits
  rateLimitsEnabled?: boolean
  rateLimitBypassKey?: string
  rateLimitBypassIps?: string[]

  // redis
  redisScratchAddress?: string
  redisScratchPassword?: string

  // crawler
  crawlers?: string[]

  // secrets
  jwtSecret?: string
  adminPassword?: string
  moderatorPassword?: string
  triagePassword?: string

  // keys
  repoSigningKeyKmsKeyId?: string
  repoSigningKeyK256PrivateKeyHex?: string
  plcRotationKeyKmsKeyId?: string
  plcRotationKeyK256PrivateKeyHex?: string
}
