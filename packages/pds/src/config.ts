import os from 'node:os'
import path from 'node:path'
import { parseIntWithFallback, DAY, HOUR, SECOND } from '@atproto/common'

// off-config but still from env:
// repo signing key (two flavors?), recovery key
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export interface ServerEnvironment {
  // infra
  port?: number
  hostname: string
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

  // secrets
  jwtSecret: string
  adminPassword: string
  moderatorPassword?: string

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

const envToCfg = (env: ServerEnvironment): ConfigTakeTwo => {
  const port = env.port ?? 2583
  const hostname = env.hostname
  const did = env.serviceDid ?? `did:web:${hostname}`
  const serviceCfg = {
    port,
    hostname,
    did,
    version: env.version, // default?
    privacyPolicyUrl: env.privacyPolicyUrl,
    termsOfServiceUrl: env.termsOfServiceUrl,
  }

  let dbCfg: ConfigTakeTwo['db']
  if (env.dbSqliteLocation && env.dbPostgresUrl) {
    throw new Error('Cannot set both sqlite & postgres db env vars')
  }
  if (env.dbSqliteLocation) {
    dbCfg = {
      dialect: 'sqlite',
      location: env.dbSqliteLocation,
    }
  } else if (env.dbPostgresUrl) {
    dbCfg = {
      dialect: 'pg',
      url: env.dbPostgresUrl,
      migrationUrl: env.dbPostgresMigrationUrl || env.dbPostgresUrl,
      schema: env.dbPostgresSchema,
      pool: {
        idleTimeoutMs: env.dbPostgresPoolIdleTimeoutMs ?? 10000,
        maxUses: env.dbPostgresPoolMaxUses || Infinity,
        size: env.dbPostgresPoolSize ?? 10,
      },
    }
  } else {
    throw new Error('Must configure either sqlite or postgres db')
  }

  let blobstoreCfg: ConfigTakeTwo['blobstore']
  if (env.blobstoreS3Bucket && env.blobstoreDiskLocation) {
    throw new Error('Cannot set both S3 and disk blobstore env vars')
  }
  if (env.blobstoreS3Bucket) {
    blobstoreCfg = { provider: 's3', bucket: env.blobstoreS3Bucket }
  } else if (env.blobstoreDiskLocation) {
    blobstoreCfg = {
      provider: 'disk',
      location: env.blobstoreDiskLocation,
      tempLocation:
        env.blobstoreDiskTmpLocation || path.join(os.tmpdir(), 'pds/blobs'),
      quarantineLocation: path.join(env.blobstoreDiskLocation, 'quarantine'),
    }
  } else {
    throw new Error('Must configure either S3 or disk blobstore')
  }

  const secretsCfg: ConfigTakeTwo['secrets'] = {
    jwtSecret: env.jwtSecret,
    adminPassword: env.adminPassword,
    moderatorPassword: env.moderatorPassword || env.adminPassword,
  }

  const handleDomains =
    env.handleDomains && env.handleDomains.length > 0
      ? env.handleDomains
      : [env.hostname]
  const identityCfg: ConfigTakeTwo['identity'] = {
    plcUrl: env.didPlcUrl || 'https://plc.bsky-sandbox.dev',
    cacheMaxTTL: env.didCacheMaxTTL || DAY,
    cacheStaleTTL: env.didCacheStaleTTL || HOUR,
    resolverTimeout: env.resolverTimeout || 3 * SECOND,
    recoveryDidKey: env.recoveryDidKey ?? null,
    handleDomains,
  }

  const invitesCfg: ConfigTakeTwo['invites'] = env.inviteRequired
    ? {
        required: true,
        interval: env.inviteInterval ?? null,
      }
    : {
        required: false,
      }

  let emailCfg: ConfigTakeTwo['email']
  if (!env.emailFromAddress && !env.emailSmtpUrl) {
    emailCfg = null
  } else {
    if (!env.emailFromAddress || !env.emailSmtpUrl) {
      throw new Error('Partial email config')
    }
    emailCfg = {
      smtpUrl: env.emailSmtpUrl,
      fromAddress: env.emailFromAddress,
    }
  }

  const subscriptionCfg: ConfigTakeTwo['subscription'] = {
    maxBuffer: env.maxSubscriptionBuffer ?? 500,
    repoBackfillLimitMs: env.repoBackfillLimitMs ?? DAY,
    sequencerLeaderLockId: env.sequencerLeaderLockId ?? 1100,
  }

  const bskyAppViewCfg: ConfigTakeTwo['bskyAppView'] = {
    endpoint: env.bskyAppViewEndpoint ?? 'https://api.bsky-sandbox.dev',
    did: env.bskyAppViewDid ?? 'did:plc:abc', // get real did
  }

  const crawlersCfg: ConfigTakeTwo['crawlers'] = env.crawlers ?? []

  return {
    service: serviceCfg,
    db: dbCfg,
    blobstore: blobstoreCfg,
    secrets: secretsCfg,
    identity: identityCfg,
    invites: invitesCfg,
    email: emailCfg,
    subscription: subscriptionCfg,
    bskyAppView: bskyAppViewCfg,
    crawlers: crawlersCfg,
  }
}

export type ConfigTakeTwo = {
  service: ServiceConfig
  db: SqliteConfig | PostgresConfig
  blobstore: S3BlobstoreConfig | DiskBlobstoreConfig
  secrets: SecretsConfig
  identity: IdentityConfig
  invites: InvitesConfig
  email: EmailConfig | null
  subscription: SubscriptionConfig
  bskyAppView: BksyAppViewConfig
  crawlers: string[]
}

export type ServiceConfig = {
  port: number
  hostname: string
  did: string
  version?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
}

export type SqliteConfig = {
  dialect: 'sqlite'
  location: string
}

export type PostgresPoolConfig = {
  size: number
  maxUses: number
  idleTimeoutMs: number
}

export type PostgresConfig = {
  dialect: 'pg'
  url: string
  migrationUrl: string
  pool: PostgresPoolConfig
  schema?: string
}

export type S3BlobstoreConfig = {
  provider: 's3'
  bucket: string
}

export type DiskBlobstoreConfig = {
  provider: 'disk'
  location: string
  tempLocation: string
  quarantineLocation: string
}

export type SecretsConfig = {
  jwtSecret: string
  adminPassword: string
  moderatorPassword: string
}

export type IdentityConfig = {
  plcUrl: string
  resolverTimeout: number
  cacheStaleTTL: number
  cacheMaxTTL: number
  recoveryDidKey: string | null
  handleDomains: string[]
}

export type InvitesConfig =
  | {
      required: true
      interval: number | null
    }
  | {
      required: false
    }

export type EmailConfig = {
  smtpUrl: string
  fromAddress: string
}

export type SubscriptionConfig = {
  maxBuffer: number
  repoBackfillLimitMs: number
  sequencerLeaderLockId: number
}

export type BksyAppViewConfig = {
  endpoint: string
  did: string
}
