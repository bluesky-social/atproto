import { envInt, envStr, envBool, envList } from './util'

export const readEnv = (): ServerEnvironment => {
  return {
    // service
    port: envInt('PDS_PORT'),
    hostname: envStr('PDS_HOSTNAME'),
    serviceDid: envStr('PDS_SERVICE_DID'),
    version: envStr('PDS_VERSION'),
    isEntryway: envBool('PDS_IS_ENTRYWAY'),
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
    blobstoreS3Region: envStr('PDS_BLOBSTORE_S3_REGION'),
    blobstoreS3Endpoint: envStr('PDS_BLOBSTORE_S3_ENDPOINT'),
    blobstoreS3ForcePathStyle: envBool('PDS_BLOBSTORE_S3_FORCE_PATH_STYLE'),
    blobstoreS3AccessKeyId: envStr('PDS_BLOBSTORE_S3_ACCESS_KEY_ID'),
    blobstoreS3SecretAccessKey: envStr('PDS_BLOBSTORE_S3_SECRET_ACCESS_KEY'),
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
    enableDidDocWithSession: envBool('PDS_ENABLE_DID_DOC_WITH_SESSION'),

    // invites
    inviteRequired: envBool('PDS_INVITE_REQUIRED'),
    inviteInterval: envInt('PDS_INVITE_INTERVAL'),
    inviteEpoch: envInt('PDS_INVITE_EPOCH'),

    // phone verification
    phoneVerificationRequired: envBool('PDS_PHONE_VERIFICATION_REQUIRED'),
    phoneVerificationProvider: envStr('PDS_PHONE_VERIFICATION_PROVIDER'),
    accountsPerPhoneNumber: envInt('PDS_ACCOUNTS_PER_PHONE_NUMBER'),
    bypassPhoneNumber: envStr('PDS_BYPASS_PHONE_NUMBER'),
    twilioAccountSid: envStr('PDS_TWILIO_ACCOUNT_SID'),
    twilioAuthToken: envStr('PDS_TWILIO_AUTH_TOKEN'),
    twilioServiceSid: envStr('PDS_TWILIO_SERVICE_SID'),
    plivoAuthId: envStr('PDS_PLIVO_AUTH_ID'),
    plivoAuthToken: envStr('PDS_PLIVO_AUTH_TOKEN'),
    plivoAppId: envStr('PDS_PLIVO_APP_ID'),

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
    bskyAppViewCdnUrlPattern: envStr('PDS_BSKY_APP_VIEW_CDN_URL_PATTERN'),

    // mod service
    modServiceUrl: envStr('PDS_MOD_SERVICE_URL'),
    modServiceDid: envStr('PDS_MOD_SERVICE_DID'),

    // rate limits
    rateLimitsEnabled: envBool('PDS_RATE_LIMITS_ENABLED'),
    rateLimitBypassKey: envStr('PDS_RATE_LIMIT_BYPASS_KEY'),
    rateLimitBypassIps: envList('PDS_RATE_LIMIT_BYPASS_IPS'),

    // redis
    redisScratchAddress: envStr('PDS_REDIS_SCRATCH_ADDRESS'),
    redisScratchPassword: envStr('PDS_REDIS_SCRATCH_PASSWORD'),

    // activator
    courierUrl: envStr('PDS_COURIER_URL'),
    courierHttpVersion: envStr('PDS_COURIER_HTTP_VERSION'),
    courierIgnoreBadTls: envBool('PDS_COURIER_IGNORE_BAD_TLS'),
    courierApiKey: envStr('PDS_COURIER_API_KEY'),
    activatorEmailsPerDay: envInt('PDS_ACTIVATOR_EMAILS_PER_DAY'),

    // crawlers
    crawlers: envList('PDS_CRAWLERS'),

    // secrets
    jwtSecret: envStr('PDS_JWT_SECRET'),
    jwtSigningKeyK256PrivateKeyHex: envStr(
      'PDS_JWT_SIGNING_KEY_K256_PRIVATE_KEY_HEX',
    ),
    jwtVerifyKeyK256PublicKeyHex: envStr(
      'PDS_JWT_VERIFY_KEY_K256_PUBLIC_KEY_HEX',
    ),
    jweSecret128BitHex: envStr('PDS_JWE_SECRET_128BIT_HEX'),
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
  isEntryway?: boolean
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

  // -- optional s3 parameters
  blobstoreS3Region?: string
  blobstoreS3Endpoint?: string
  blobstoreS3ForcePathStyle?: boolean
  blobstoreS3AccessKeyId?: string
  blobstoreS3SecretAccessKey?: string

  // identity
  didPlcUrl?: string
  didCacheStaleTTL?: number
  didCacheMaxTTL?: number
  resolverTimeout?: number
  recoveryDidKey?: string
  serviceHandleDomains?: string[] // public hostname by default
  handleBackupNameservers?: string[]
  enableDidDocWithSession?: boolean

  // invites
  inviteRequired?: boolean
  inviteInterval?: number
  inviteEpoch?: number

  // phone verification
  phoneVerificationRequired?: boolean
  phoneVerificationProvider?: string
  accountsPerPhoneNumber?: number
  bypassPhoneNumber?: string
  twilioAccountSid?: string
  twilioAuthToken?: string
  twilioServiceSid?: string
  plivoAuthId?: string
  plivoAuthToken?: string
  plivoAppId?: string

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
  bskyAppViewCdnUrlPattern?: string

  // mod service
  modServiceUrl?: string
  modServiceDid?: string

  // rate limits
  rateLimitsEnabled?: boolean
  rateLimitBypassKey?: string
  rateLimitBypassIps?: string[]

  // redis
  redisScratchAddress?: string
  redisScratchPassword?: string

  // activator
  courierUrl?: string
  courierHttpVersion?: string
  courierIgnoreBadTls?: boolean
  courierApiKey?: string
  activatorEmailsPerDay?: number

  // crawler
  crawlers?: string[]

  // secrets
  jwtSecret?: string
  jwtSigningKeyK256PrivateKeyHex?: string
  jwtVerifyKeyK256PublicKeyHex?: string
  jweSecret128BitHex?: string
  adminPassword?: string
  moderatorPassword?: string
  triagePassword?: string

  // keys
  repoSigningKeyKmsKeyId?: string
  repoSigningKeyK256PrivateKeyHex?: string
  plcRotationKeyKmsKeyId?: string
  plcRotationKeyK256PrivateKeyHex?: string
}
