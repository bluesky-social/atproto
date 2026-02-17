import { envBool, envInt, envList, envStr } from '@atproto/common'
import { NeuroConfig } from './config'

export function readEnv() {
  return {
    // service
    port: envInt('PDS_PORT'),
    hostname: envStr('PDS_HOSTNAME'),
    serviceDid: envStr('PDS_SERVICE_DID'),
    serviceName: envStr('PDS_SERVICE_NAME'),
    version: envStr('PDS_VERSION'),
    homeUrl: envStr('PDS_HOME_URL'),
    logoUrl: envStr('PDS_LOGO_URL'),
    privacyPolicyUrl: envStr('PDS_PRIVACY_POLICY_URL'),
    supportUrl: envStr('PDS_SUPPORT_URL'),
    termsOfServiceUrl: envStr('PDS_TERMS_OF_SERVICE_URL'),
    contactEmailAddress: envStr('PDS_CONTACT_EMAIL_ADDRESS'),
    acceptingImports: envBool('PDS_ACCEPTING_REPO_IMPORTS'),
    maxImportSize: envInt('PDS_MAX_REPO_IMPORT_SIZE'),
    blobUploadLimit: envInt('PDS_BLOB_UPLOAD_LIMIT'),
    devMode: envBool('PDS_DEV_MODE'),

    // hCaptcha
    hcaptchaSiteKey: envStr('PDS_HCAPTCHA_SITE_KEY'),
    hcaptchaSecretKey: envStr('PDS_HCAPTCHA_SECRET_KEY'),
    hcaptchaTokenSalt: envStr('PDS_HCAPTCHA_TOKEN_SALT'),

    // OAuth
    trustedOAuthClients: envList('PDS_OAUTH_TRUSTED_CLIENTS'),

    // branding
    lightColor: envStr('PDS_LIGHT_COLOR'),
    darkColor: envStr('PDS_DARK_COLOR'),
    primaryColor: envStr('PDS_PRIMARY_COLOR'),
    primaryColorContrast: envStr('PDS_PRIMARY_COLOR_CONTRAST'),
    primaryColorHue: envInt('PDS_PRIMARY_COLOR_HUE'),
    errorColor: envStr('PDS_ERROR_COLOR'),
    errorColorContrast: envStr('PDS_ERROR_COLOR_CONTRAST'),
    errorColorHue: envInt('PDS_ERROR_COLOR_HUE'),
    warningColor: envStr('PDS_WARNING_COLOR'),
    warningColorContrast: envStr('PDS_WARNING_COLOR_CONTRAST'),
    warningColorHue: envInt('PDS_WARNING_COLOR_HUE'),
    successColor: envStr('PDS_SUCCESS_COLOR'),
    successColorContrast: envStr('PDS_SUCCESS_COLOR_CONTRAST'),
    successColorHue: envInt('PDS_SUCCESS_COLOR_HUE'),

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
    blobstoreS3UploadTimeoutMs: envInt('PDS_BLOBSTORE_S3_UPLOAD_TIMEOUT_MS'),
    // disk
    blobstoreDiskLocation: envStr('PDS_BLOBSTORE_DISK_LOCATION'),
    blobstoreDiskTmpLocation: envStr('PDS_BLOBSTORE_DISK_TMP_LOCATION'),

    // identity
    didPlcUrl: envStr('PDS_DID_PLC_URL'),
    didCacheStaleTTL: envInt('PDS_DID_CACHE_STALE_TTL'),
    didCacheMaxTTL: envInt('PDS_DID_CACHE_MAX_TTL'),
    resolverTimeout: envInt('PDS_ID_RESOLVER_TIMEOUT'),
    recoveryDidKey: envStr('PDS_RECOVERY_DID_KEY'),
    serviceHandleDomains: envList('PDS_SERVICE_HANDLE_DOMAINS'), // public hostname by default
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
    dpopSecret: envStr('PDS_DPOP_SECRET'),
    jwtSecret: envStr('PDS_JWT_SECRET'),
    adminPassword: envStr('PDS_ADMIN_PASSWORD'),
    entrywayAdminToken: envStr('PDS_ENTRYWAY_ADMIN_TOKEN'),

    // kms
    plcRotationKeyKmsKeyId: envStr('PDS_PLC_ROTATION_KEY_KMS_KEY_ID'),
    // memory
    plcRotationKeyK256PrivateKeyHex: envStr(
      'PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX',
    ),

    // user provided url http requests
    disableSsrfProtection: envBool('PDS_DISABLE_SSRF_PROTECTION'),

    // fetch
    fetchMaxResponseSize: envInt('PDS_FETCH_MAX_RESPONSE_SIZE'),

    // proxy
    proxyAllowHTTP2: envBool('PDS_PROXY_ALLOW_HTTP2'),
    proxyHeadersTimeout: envInt('PDS_PROXY_HEADERS_TIMEOUT'),
    proxyBodyTimeout: envInt('PDS_PROXY_BODY_TIMEOUT'),
    proxyMaxResponseSize: envInt('PDS_PROXY_MAX_RESPONSE_SIZE'),
    proxyMaxRetries: envInt('PDS_PROXY_MAX_RETRIES'),
    proxyPreferCompressed: envBool('PDS_PROXY_PREFER_COMPRESSED'),

    // lexicon resolution
    lexiconDidAuthority: envStr('PDS_LEXICON_AUTHORITY_DID'),

    // neuro
    neuro: envBool('PDS_NEURO_ENABLED')
      ? ({
          enabled: true,
          domain: envStr('PDS_NEURO_DOMAIN') || 'mateo.lab.tagroot.io',
          storageBackend:
            (envStr('PDS_NEURO_STORAGE_BACKEND') as 'database' | 'redis') ||
            'database',
          customUiPath: envStr('PDS_NEURO_CUSTOM_UI_PATH'),
          // RemoteLogin API configuration
          apiType: (envStr('PDS_NEURO_API_TYPE') as 'quicklogin' | 'remotelogin' | 'both') || 'remotelogin',
          responseMethod: (envStr('PDS_NEURO_RESPONSE_METHOD') as 'Callback' | 'Poll') || 'Callback',
          callbackBaseUrl: envStr('PDS_NEURO_CALLBACK_BASE_URL'),
          pollIntervalMs: envInt('PDS_NEURO_POLL_INTERVAL_MS') || 2000,
          // Authentication for RemoteLogin API
          authMethod: (envStr('PDS_NEURO_AUTH_METHOD') as 'basic' | 'bearer' | 'mtls') || 'basic',
          basicUsername: envStr('PDS_NEURO_BASIC_USERNAME'),
          basicPassword: envStr('PDS_NEURO_BASIC_PASSWORD'),
          bearerToken: envStr('PDS_NEURO_BEARER_TOKEN'),
          // JWT verification
          verifyJwtSignature: envBool('PDS_NEURO_VERIFY_JWT') ?? false,
          petitionTimeoutSeconds: envInt('PDS_NEURO_PETITION_TIMEOUT') || 300,
        } as NeuroConfig)
      : undefined,

    // quicklogin (simpler standalone implementation)
    quickloginEnabled: envBool('PDS_QUICKLOGIN_ENABLED'),
    quickloginApiBaseUrl: envStr('PDS_QUICKLOGIN_API_BASE_URL'),
  }
}

export type ServerEnvironment = Partial<ReturnType<typeof readEnv>>
