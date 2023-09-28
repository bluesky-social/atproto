import { parseIntWithFallback, DAY, HOUR } from '@atproto/common'

export interface ServerConfigValues {
  debugMode?: boolean
  version: string

  publicUrl?: string
  scheme: string
  port?: number
  hostname: string

  dbPostgresUrl?: string
  dbPostgresSchema?: string

  blobstoreLocation?: string
  blobstoreTmp?: string

  jwtSecret: string

  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number

  serverDid: string
  recoveryKey: string
  adminPassword: string
  moderatorPassword?: string
  triagePassword?: string

  inviteRequired: boolean
  userInviteInterval: number | null
  userInviteEpoch: number
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string

  databaseLocation?: string

  availableUserDomains: string[]
  handleResolveNameservers?: string[]

  rateLimitsEnabled: boolean
  rateLimitBypassKey?: string
  rateLimitBypassIps?: string[]
  redisScratchAddress?: string
  redisScratchPassword?: string

  appUrlPasswordReset: string
  emailSmtpUrl?: string
  emailNoReplyAddress: string
  moderationEmailAddress?: string
  moderationEmailSmtpUrl?: string

  maxSubscriptionBuffer: number
  repoBackfillLimitMs: number
  sequencerLeaderLockId?: number
  sequencerLeaderEnabled?: boolean

  // this is really only used in test environments
  dbTxLockNonce?: string

  bskyAppViewEndpoint: string
  bskyAppViewDid: string
  bskyAppViewModeration?: boolean
  bskyAppViewCdnUrlPattern?: string

  crawlersToNotify?: string[]
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
    const debugMode = process.env.DEBUG_MODE === '1'
    const version = process.env.PDS_VERSION || '0.0.0'

    const publicUrl = process.env.PUBLIC_URL || undefined
    const hostname = process.env.HOSTNAME || 'localhost'
    let scheme
    if ('TLS' in process.env) {
      scheme = process.env.TLS === '1' ? 'https' : 'http'
    } else {
      scheme = hostname === 'localhost' ? 'http' : 'https'
    }
    const port = parseIntWithFallback(process.env.PORT, 2583)

    const jwtSecret = process.env.JWT_SECRET || 'jwt_secret'

    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )

    const serverDid = overrides?.serverDid || process.env.SERVER_DID
    if (typeof serverDid !== 'string') {
      throw new Error('No value provided for process.env.SERVER_DID')
    }

    const recoveryKey = overrides?.recoveryKey || process.env.RECOVERY_KEY
    if (typeof recoveryKey !== 'string') {
      throw new Error('No value provided for process.env.RECOVERY_KEY')
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined
    const triagePassword = process.env.TRIAGE_PASSWORD || undefined

    const inviteRequired = process.env.INVITE_REQUIRED === 'true' ? true : false
    const userInviteInterval = parseIntWithFallback(
      process.env.USER_INVITE_INTERVAL,
      null,
    )
    const userInviteEpoch = parseIntWithFallback(
      process.env.USER_INVITE_EPOCH,
      0,
    )

    const privacyPolicyUrl = process.env.PRIVACY_POLICY_URL
    const termsOfServiceUrl = process.env.TERMS_OF_SERVICE_URL

    const databaseLocation = process.env.DATABASE_LOC

    const blobstoreLocation = process.env.BLOBSTORE_LOC
    const blobstoreTmp = process.env.BLOBSTORE_TMP

    const availableUserDomains = process.env.AVAILABLE_USER_DOMAINS
      ? process.env.AVAILABLE_USER_DOMAINS.split(',')
      : []

    const handleResolveNameservers = process.env.HANDLE_RESOLVE_NAMESERVERS
      ? process.env.HANDLE_RESOLVE_NAMESERVERS.split(',')
      : []

    const rateLimitsEnabled = process.env.RATE_LIMITS_ENABLED === 'true'
    const rateLimitBypassKey = nonemptyString(process.env.RATE_LIMIT_BYPASS_KEY)
    const rateLimitBypassIpsStr = nonemptyString(
      process.env.RATE_LIMIT_BYPASS_IPS,
    )
    const rateLimitBypassIps = rateLimitBypassIpsStr
      ? rateLimitBypassIpsStr.split(',').map((ipOrCidr) => {
          const ip = ipOrCidr.split('/')[0]
          return ip.trim()
        })
      : undefined
    const redisScratchAddress = nonemptyString(
      process.env.REDIS_SCRATCH_ADDRESS,
    )
    const redisScratchPassword = nonemptyString(
      process.env.REDIS_SCRATCH_PASSWORD,
    )

    const appUrlPasswordReset =
      process.env.APP_URL_PASSWORD_RESET || 'app://password-reset'

    const emailSmtpUrl = process.env.EMAIL_SMTP_URL || undefined

    const emailNoReplyAddress =
      process.env.EMAIL_NO_REPLY_ADDRESS || 'noreply@blueskyweb.xyz'

    const moderationEmailAddress =
      process.env.MODERATION_EMAIL_ADDRESS || undefined
    const moderationEmailSmtpUrl =
      process.env.MODERATION_EMAIL_SMTP_URL || undefined

    const dbPostgresUrl = process.env.DB_POSTGRES_URL
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA

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

    // by default each instance is a potential sequencer leader, but may be configured off
    const sequencerLeaderEnabled = process.env.SEQUENCER_LEADER_ENABLED
      ? process.env.SEQUENCER_LEADER_ENABLED !== '0' &&
        process.env.SEQUENCER_LEADER_ENABLED !== 'false'
      : undefined

    const dbTxLockNonce = nonemptyString(process.env.DB_TX_LOCK_NONCE)

    const bskyAppViewEndpoint = nonemptyString(
      process.env.BSKY_APP_VIEW_ENDPOINT,
    )
    if (typeof bskyAppViewEndpoint !== 'string') {
      throw new Error(
        'No value provided for process.env.BSKY_APP_VIEW_ENDPOINT',
      )
    }
    const bskyAppViewDid = nonemptyString(process.env.BSKY_APP_VIEW_DID)
    if (typeof bskyAppViewDid !== 'string') {
      throw new Error('No value provided for process.env.BSKY_APP_VIEW_DID')
    }
    const bskyAppViewModeration =
      process.env.BSKY_APP_VIEW_MODERATION === 'true' ? true : false
    const bskyAppViewCdnUrlPattern = nonemptyString(
      process.env.BSKY_APP_VIEW_CDN_URL_PATTERN,
    )

    const crawlersEnv = process.env.CRAWLERS_TO_NOTIFY
    const crawlersToNotify =
      crawlersEnv && crawlersEnv.length > 0 ? crawlersEnv.split(',') : []

    return new ServerConfig({
      debugMode,
      version,
      publicUrl,
      scheme,
      hostname,
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
      serverDid,
      adminPassword,
      moderatorPassword,
      triagePassword,
      inviteRequired,
      userInviteInterval,
      userInviteEpoch,
      privacyPolicyUrl,
      termsOfServiceUrl,
      databaseLocation,
      availableUserDomains,
      handleResolveNameservers,
      rateLimitsEnabled,
      rateLimitBypassKey,
      rateLimitBypassIps,
      redisScratchAddress,
      redisScratchPassword,
      appUrlPasswordReset,
      emailSmtpUrl,
      emailNoReplyAddress,
      moderationEmailAddress,
      moderationEmailSmtpUrl,
      maxSubscriptionBuffer,
      repoBackfillLimitMs,
      sequencerLeaderLockId,
      sequencerLeaderEnabled,
      dbTxLockNonce,
      bskyAppViewEndpoint,
      bskyAppViewDid,
      bskyAppViewModeration,
      bskyAppViewCdnUrlPattern,
      crawlersToNotify,
      ...overrides,
    })
  }

  get debugMode() {
    return !!this.cfg.debugMode
  }

  get version() {
    return this.cfg.version
  }

  get scheme() {
    return this.cfg.scheme
  }

  get port() {
    return this.cfg.port
  }

  get hostname() {
    return this.cfg.hostname
  }

  get internalUrl() {
    return `${this.scheme}://${this.hostname}:${this.port}`
  }

  get origin() {
    const u = new URL(this.internalUrl)
    return u.origin
  }

  get publicUrl() {
    return this.cfg.publicUrl || this.internalUrl
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

  get triagePassword() {
    return this.cfg.triagePassword
  }

  get inviteRequired() {
    return this.cfg.inviteRequired
  }

  get userInviteInterval() {
    return this.cfg.userInviteInterval
  }

  get userInviteEpoch() {
    return this.cfg.userInviteEpoch
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

  get databaseLocation() {
    return this.cfg.databaseLocation
  }

  get useMemoryDatabase() {
    return !this.databaseLocation
  }

  get availableUserDomains() {
    return this.cfg.availableUserDomains
  }

  get handleResolveNameservers() {
    return this.cfg.handleResolveNameservers
  }

  get rateLimitsEnabled() {
    return this.cfg.rateLimitsEnabled
  }

  get rateLimitBypassKey() {
    return this.cfg.rateLimitBypassKey
  }

  get rateLimitBypassIps() {
    return this.cfg.rateLimitBypassIps
  }

  get redisScratchAddress() {
    return this.cfg.redisScratchAddress
  }

  get redisScratchPassword() {
    return this.cfg.redisScratchPassword
  }

  get appUrlPasswordReset() {
    return this.cfg.appUrlPasswordReset
  }

  get emailSmtpUrl() {
    return this.cfg.emailSmtpUrl
  }

  get emailNoReplyAddress() {
    return this.cfg.emailNoReplyAddress
  }

  get moderationEmailAddress() {
    return this.cfg.moderationEmailAddress
  }

  get moderationEmailSmtpUrl() {
    return this.cfg.moderationEmailSmtpUrl
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

  get sequencerLeaderEnabled() {
    return this.cfg.sequencerLeaderEnabled !== false
  }

  get dbTxLockNonce() {
    return this.cfg.dbTxLockNonce
  }

  get bskyAppViewEndpoint() {
    return this.cfg.bskyAppViewEndpoint
  }

  get bskyAppViewDid() {
    return this.cfg.bskyAppViewDid
  }

  get bskyAppViewModeration() {
    return this.cfg.bskyAppViewModeration
  }

  get bskyAppViewCdnUrlPattern() {
    return this.cfg.bskyAppViewCdnUrlPattern
  }

  get crawlersToNotify() {
    return this.cfg.crawlersToNotify
  }
}

const nonemptyString = (str: string | undefined): string | undefined => {
  if (str === undefined || str.length === 0) return undefined
  return str
}
