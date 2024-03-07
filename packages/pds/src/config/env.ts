import { envInt, envStr, envBool, envList } from '@atproto/common'

export const readEnv = (): ServerEnvironment => {
  return {
    // service
    port: envInt('PDS_PORT'),
    hostname: envStr('PDS_HOSTNAME'),
    serviceDid: envStr('PDS_SERVICE_DID'),
    version: envStr('PDS_VERSION'),
    privacyPolicyUrl: envStr('PDS_PRIVACY_POLICY_URL'),
    termsOfServiceUrl: envStr('PDS_TERMS_OF_SERVICE_URL'),
    acceptingImports: envBool('PDS_ACCEPTING_REPO_IMPORTS'),
    blobUploadLimit: envInt('PDS_BLOB_UPLOAD_LIMIT'),
    devMode: envBool('PDS_DEV_MODE'),

    // database
    dataDirectory: envStr('PDS_DATA_DIRECTORY'),
    disableWalAutoCheckpoint: envBool('PDS_SQLITE_DISABLE_WAL_AUTO_CHECKPOINT'),
    accountDbLocation: envStr('PDS_ACCOUNT_DB_LOCATION'),
    sequencerDbLocation: envStr('PDS_SEQUENCER_DB_LOCATION'),
    didCacheDbLocation: envStr('PDS_DID_CACHE_DB_LOCATION'),

    // actor store
    actorStoreDirectory: envStr('PDS_ACTOR_STORE_DIRECTORY'),
    actorStoreCacheSize: envInt('PDS_ACTOR_STORE_CACHE_SIZE'),

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

    // entryway
    entrywayUrl: envStr('PDS_ENTRYWAY_URL'),
    entrywayDid: envStr('PDS_ENTRYWAY_DID'),
    entrywayJwtVerifyKeyK256PublicKeyHex: envStr(
      'PDS_ENTRYWAY_JWT_VERIFY_KEY_K256_PUBLIC_KEY_HEX',
    ),
    entrywayPlcRotationKey: envStr('PDS_ENTRYWAY_PLC_ROTATION_KEY'),

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

    // appview
    bskyAppViewUrl: envStr('PDS_BSKY_APP_VIEW_URL'),
    bskyAppViewDid: envStr('PDS_BSKY_APP_VIEW_DID'),
    bskyAppViewCdnUrlPattern: envStr('PDS_BSKY_APP_VIEW_CDN_URL_PATTERN'),

    // mod service
    modServiceUrl: envStr('PDS_MOD_SERVICE_URL'),
    modServiceDid: envStr('PDS_MOD_SERVICE_DID'),

    // report service
    reportServiceUrl: envStr('PDS_REPORT_SERVICE_URL'),
    reportServiceDid: envStr('PDS_REPORT_SERVICE_DID'),

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
  acceptingImports?: boolean
  blobUploadLimit?: number
  devMode?: boolean

  // database
  dataDirectory?: string
  disableWalAutoCheckpoint?: boolean
  accountDbLocation?: string
  sequencerDbLocation?: string
  didCacheDbLocation?: string

  // actor store
  actorStoreDirectory?: string
  actorStoreCacheSize?: number

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

  // entryway
  entrywayUrl?: string
  entrywayDid?: string
  entrywayJwtVerifyKeyK256PublicKeyHex?: string
  entrywayPlcRotationKey?: string

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

  // appview
  bskyAppViewUrl?: string
  bskyAppViewDid?: string
  bskyAppViewCdnUrlPattern?: string

  // mod service
  modServiceUrl?: string
  modServiceDid?: string

  // report service
  reportServiceUrl?: string
  reportServiceDid?: string

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
  plcRotationKeyKmsKeyId?: string
  plcRotationKeyK256PrivateKeyHex?: string
}
