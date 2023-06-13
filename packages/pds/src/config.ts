import { parseIntWithFallback, DAY, HOUR } from '@atproto/common'

// off-config but still from env:
// repo signing key (two flavors?), recovery key
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export interface ServerEnvironment {
  // infra
  port?: number
  hostname: string
  version?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
  serverDid?: string

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

  // secrets
  jwtSecret: string
  adminPassword: string
  moderatorPassword?: string

  // plc
  didPlcUrl?: string
  didCacheStaleTTL?: number
  didCacheMaxTTL?: number

  // accounts
  recoveryDidKey: string
  inviteRequired?: boolean
  inviteInterval?: number | null
  handleDomains?: string[] // public hostname by default

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
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {
    const invalidDomain = cfg.availableUserDomains.find(
      (domain) => domain.length < 1 || !domain.startsWith('.'),
    )
    if (invalidDomain) {
      throw new Error(`Invalid domain: ${invalidDomain}`)
    }
  }

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = nonemptyString(process.env.PDS_VERSION)

    const publicUrl = nonemptyString(process.env.PUBLIC_URL)
    const port = parseIntWithFallback(process.env.PORT, 2583)

    const jwtSecret = nonemptyString(process.env.JWT_SECRET)

    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )

    const recoveryKey = overrides?.recoveryKey || process.env.RECOVERY_KEY
    if (typeof recoveryKey !== 'string') {
      throw new Error('No value provided for process.env.RECOVERY_KEY')
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined

    const inviteRequired = bool(process.env.INVITE_REQUIRED)
    const userInviteInterval = parseIntWithFallback(
      process.env.USER_INVITE_INTERVAL,
      null,
    )
    const privacyPolicyUrl = nonemptyString(process.env.PRIVACY_POLICY_URL)
    const termsOfServiceUrl = nonemptyString(process.env.TERMS_OF_SERVICE_URL)

    const blobstoreS3Bucket = nonemptyString(process.env.BLOBSTORE_S3_BUCKET)
    const blobstoreDiskLocation = nonemptyString(
      process.env.BLOBSTORE_DISK_LOCATION,
    )

    const availableUserDomains = commaList(process.env.AVAILABLE_USER_DOMAINS)

    const emailSmtpUrl = nonemptyString(process.env.EMAIL_SMTP_URL)
    const emailFromAddress = nonemptyString(process.env.EMAIL_FROM_ADDRESS)
    const dbSqliteLocation = nonemptyString(process.env.DB_SQLITE_LOCATION)
    const dbPostgresUrl = nonemptyString(process.env.DB_POSTGRES_URL)
    const dbPostgresSchema = nonemptyString(process.env.DB_POSTGRES_SCHEMA)

    const maxSubscriptionBuffer = parseIntWithFallback(
      process.env.MAX_SUBSCRIPTION_BUFFER,
      500,
    )

    const repoBackfillLimitMs = parseIntWithFallback(
      process.env.REPO_BACKFILL_LIMIT_MS,
      DAY,
    )

    const sequencerLeaderLockId = parseIntWithFallback(
      process.env.SEQUENCER_LEADER_LOCK_ID,
      undefined,
    )

    const bskyAppViewEndpoint = nonemptyString(
      process.env.BSKY_APP_VIEW_ENDPOINT,
    )
    const bskyAppViewDid = nonemptyString(process.env.BSKY_APP_VIEW_DID)

    const crawlersToNotify = commaList(process.env.CRAWLERS_TO_NOTIFY)

    return new ServerConfig({
      version,
      publicUrl,
      port,
      dbPostgresUrl,
      dbPostgresSchema,
      blobstoreLocation,
      blobstoreTmp,
      jwtSecret,
      recoveryKey,
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      adminPassword,
      moderatorPassword,
      inviteRequired,
      userInviteInterval,
      privacyPolicyUrl,
      termsOfServiceUrl,
      databaseLocation,
      availableUserDomains,
      appUrlPasswordReset,
      emailSmtpUrl,
      emailNoReplyAddress,
      maxSubscriptionBuffer,
      repoBackfillLimitMs,
      sequencerLeaderLockId,
      bskyAppViewEndpoint,
      bskyAppViewDid,
      crawlersToNotify,
      ...overrides,
    })
  }

  get version() {
    return this.cfg.version
  }

  get port() {
    return this.cfg.port
  }

  get publicUrl() {
    return this.cfg.publicUrl
  }

  get publicHostname() {
    const u = new URL(this.publicUrl)
    return u.hostname
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get blobstoreLocation() {
    return this.cfg.blobstoreLocation
  }

  get blobstoreTmp() {
    return this.cfg.blobstoreTmp
  }

  get jwtSecret() {
    return this.cfg.jwtSecret
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get didCacheStaleTTL() {
    return this.cfg.didCacheStaleTTL
  }

  get didCacheMaxTTL() {
    return this.cfg.didCacheMaxTTL
  }

  get serverDid() {
    return this.cfg.serverDid
  }

  get recoveryKey() {
    return this.cfg.recoveryKey
  }

  get adminPassword() {
    return this.cfg.adminPassword
  }

  get moderatorPassword() {
    return this.cfg.moderatorPassword
  }

  get inviteRequired() {
    return this.cfg.inviteRequired
  }

  get userInviteInterval() {
    return this.cfg.userInviteInterval
  }

  get privacyPolicyUrl() {
    if (
      this.cfg.privacyPolicyUrl &&
      this.cfg.privacyPolicyUrl.startsWith('/')
    ) {
      return this.publicUrl + this.cfg.privacyPolicyUrl
    }
    return this.cfg.privacyPolicyUrl
  }

  get termsOfServiceUrl() {
    if (
      this.cfg.termsOfServiceUrl &&
      this.cfg.termsOfServiceUrl.startsWith('/')
    ) {
      return this.publicUrl + this.cfg.termsOfServiceUrl
    }
    return this.cfg.termsOfServiceUrl
  }

  get availableUserDomains() {
    return this.cfg.availableUserDomains
  }

  get emailSmtpUrl() {
    return this.cfg.emailSmtpUrl
  }

  get emailNoReplyAddress() {
    return this.cfg.emailNoReplyAddress
  }

  get maxSubscriptionBuffer() {
    return this.cfg.maxSubscriptionBuffer
  }

  get repoBackfillLimitMs() {
    return this.cfg.repoBackfillLimitMs
  }

  get sequencerLeaderLockId() {
    return this.cfg.sequencerLeaderLockId
  }

  get bskyAppViewEndpoint() {
    return this.cfg.bskyAppViewEndpoint
  }

  get bskyAppViewDid() {
    return this.cfg.bskyAppViewDid
  }

  get crawlersToNotify() {
    return this.cfg.crawlersToNotify
  }
}

const nonemptyString = (str: string | undefined): string | undefined => {
  if (str === undefined || str.length === 0) return undefined
  return str
}

const bool = (str: string | undefined): boolean => {
  return str === 'true' || str === '1'
}

const commaList = (str: string | undefined): string[] => {
  if (str === undefined || str.length === 0) return []
  return str.split(',')
}
