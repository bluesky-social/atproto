import assert from 'assert'
import {
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  parseIntWithFallback,
} from '@atproto/common'

export interface ServerConfigValues {
  version: string
  debugMode?: boolean
  port?: number
  publicUrl?: string
  serverDid: string
  feedGenDid?: string
  dbPrimaryPostgresUrl: string
  dbReplicaPostgresUrls?: string[]
  dbReplicaTags?: Record<string, number[]> // E.g. { timeline: [0], thread: [1] }
  dbPostgresSchema?: string
  redisHost?: string // either set redis host, or both sentinel name and hosts
  redisSentinelName?: string
  redisSentinelHosts?: string[]
  redisPassword?: string
  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number
  labelCacheStaleTTL: number
  labelCacheMaxTTL: number
  handleResolveNameservers?: string[]
  imgUriEndpoint?: string
  blobCacheLocation?: string
  searchEndpoint?: string
  bsyncUrl?: string
  bsyncApiKey?: string
  bsyncHttpVersion?: '1.1' | '2'
  bsyncIgnoreBadTls?: boolean
  bsyncOnlyMutes?: boolean
  courierUrl?: string
  courierApiKey?: string
  courierHttpVersion?: '1.1' | '2'
  courierIgnoreBadTls?: boolean
  courierOnlyRegistration?: boolean
  adminPassword: string
  moderatorPassword: string
  triagePassword: string
  modServiceDid: string
  rateLimitsEnabled: boolean
  rateLimitBypassKey?: string
  rateLimitBypassIps?: string[]
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const debugMode = process.env.NODE_ENV !== 'production'
    const publicUrl = process.env.PUBLIC_URL || undefined
    const serverDid = process.env.SERVER_DID || 'did:example:test'
    const feedGenDid = process.env.FEED_GEN_DID
    const envPort = parseInt(process.env.PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const redisHost =
      overrides?.redisHost || process.env.REDIS_HOST || undefined
    const redisSentinelName =
      overrides?.redisSentinelName ||
      process.env.REDIS_SENTINEL_NAME ||
      undefined
    const redisSentinelHosts =
      overrides?.redisSentinelHosts ||
      (process.env.REDIS_SENTINEL_HOSTS
        ? process.env.REDIS_SENTINEL_HOSTS.split(',')
        : [])
    const redisPassword =
      overrides?.redisPassword || process.env.REDIS_PASSWORD || undefined
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )
    const labelCacheStaleTTL = parseIntWithFallback(
      process.env.LABEL_CACHE_STALE_TTL,
      30 * SECOND,
    )
    const labelCacheMaxTTL = parseIntWithFallback(
      process.env.LABEL_CACHE_MAX_TTL,
      MINUTE,
    )
    const handleResolveNameservers = process.env.HANDLE_RESOLVE_NAMESERVERS
      ? process.env.HANDLE_RESOLVE_NAMESERVERS.split(',')
      : []
    const imgUriEndpoint = process.env.IMG_URI_ENDPOINT
    const blobCacheLocation = process.env.BLOB_CACHE_LOC
    const searchEndpoint = process.env.SEARCH_ENDPOINT
    const bsyncUrl = process.env.BSKY_BSYNC_URL || undefined
    const bsyncApiKey = process.env.BSKY_BSYNC_API_KEY || undefined
    const bsyncHttpVersion = process.env.BSKY_BSYNC_HTTP_VERSION || '2'
    const bsyncIgnoreBadTls = process.env.BSKY_BSYNC_IGNORE_BAD_TLS === 'true'
    const bsyncOnlyMutes = process.env.BSKY_BSYNC_ONLY_MUTES === 'true'
    assert(!bsyncOnlyMutes || bsyncUrl, 'bsync-only mutes requires a bsync url')
    assert(bsyncHttpVersion === '1.1' || bsyncHttpVersion === '2')
    const courierUrl = process.env.BSKY_COURIER_URL || undefined
    const courierApiKey = process.env.BSKY_COURIER_API_KEY || undefined
    const courierHttpVersion = process.env.BSKY_COURIER_HTTP_VERSION || '2'
    const courierIgnoreBadTls =
      process.env.BSKY_COURIER_IGNORE_BAD_TLS === 'true'
    const courierOnlyRegistration =
      process.env.BSKY_COURIER_ONLY_REGISTRATION === 'true'
    assert(
      !courierOnlyRegistration || courierUrl,
      'courier-only registration requires a courier url',
    )
    assert(courierHttpVersion === '1.1' || courierHttpVersion === '2')
    const dbPrimaryPostgresUrl =
      overrides?.dbPrimaryPostgresUrl || process.env.DB_PRIMARY_POSTGRES_URL
    let dbReplicaPostgresUrls = overrides?.dbReplicaPostgresUrls
    if (!dbReplicaPostgresUrls && process.env.DB_REPLICA_POSTGRES_URLS) {
      dbReplicaPostgresUrls = process.env.DB_REPLICA_POSTGRES_URLS.split(',')
    }
    const dbReplicaTags = overrides?.dbReplicaTags ?? {
      '*': getTagIdxs(process.env.DB_REPLICA_TAGS_ANY), // e.g. DB_REPLICA_TAGS_ANY=0,1
      timeline: getTagIdxs(process.env.DB_REPLICA_TAGS_TIMELINE),
      feed: getTagIdxs(process.env.DB_REPLICA_TAGS_FEED),
      search: getTagIdxs(process.env.DB_REPLICA_TAGS_SEARCH),
      thread: getTagIdxs(process.env.DB_REPLICA_TAGS_THREAD),
    }
    assert(
      Object.values(dbReplicaTags)
        .flat()
        .every((idx) => idx < (dbReplicaPostgresUrls?.length ?? 0)),
      'out of range index in replica tags',
    )
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA
    assert(dbPrimaryPostgresUrl)
    const adminPassword = process.env.ADMIN_PASSWORD || undefined
    assert(adminPassword)
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined
    assert(moderatorPassword)
    const triagePassword = process.env.TRIAGE_PASSWORD || undefined
    assert(triagePassword)
    const modServiceDid =
      overrides?.modServiceDid ||
      process.env.MODERATION_SERVICE_DID ||
      undefined
    assert(modServiceDid)
    const rateLimitsEnabled = process.env.RATE_LIMITS_ENABLED === 'true'
    const rateLimitBypassKey = process.env.RATE_LIMIT_BYPASS_KEY
    const rateLimitBypassIps = process.env.RATE_LIMIT_BYPASS_IPS
      ? process.env.RATE_LIMIT_BYPASS_IPS.split(',').map((ipOrCidr) =>
          ipOrCidr.split('/')[0]?.trim(),
        )
      : undefined

    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      serverDid,
      feedGenDid,
      dbPrimaryPostgresUrl,
      dbReplicaPostgresUrls,
      dbReplicaTags,
      dbPostgresSchema,
      redisHost,
      redisSentinelName,
      redisSentinelHosts,
      redisPassword,
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      labelCacheStaleTTL,
      labelCacheMaxTTL,
      handleResolveNameservers,
      imgUriEndpoint,
      blobCacheLocation,
      searchEndpoint,
      bsyncUrl,
      bsyncApiKey,
      bsyncHttpVersion,
      bsyncIgnoreBadTls,
      bsyncOnlyMutes,
      courierUrl,
      courierApiKey,
      courierHttpVersion,
      courierIgnoreBadTls,
      courierOnlyRegistration,
      adminPassword,
      moderatorPassword,
      triagePassword,
      modServiceDid,
      rateLimitsEnabled,
      rateLimitBypassKey,
      rateLimitBypassIps,
      ...stripUndefineds(overrides ?? {}),
    })
  }

  assignPort(port: number) {
    assert(
      !this.cfg.port || this.cfg.port === port,
      'Conflicting port in config',
    )
    this.assignedPort = port
  }

  get version() {
    return this.cfg.version
  }

  get debugMode() {
    return !!this.cfg.debugMode
  }

  get port() {
    return this.assignedPort || this.cfg.port
  }

  get localUrl() {
    assert(this.port, 'No port assigned')
    return `http://localhost:${this.port}`
  }

  get publicUrl() {
    return this.cfg.publicUrl
  }

  get serverDid() {
    return this.cfg.serverDid
  }

  get feedGenDid() {
    return this.cfg.feedGenDid
  }

  get dbPrimaryPostgresUrl() {
    return this.cfg.dbPrimaryPostgresUrl
  }

  get dbReplicaPostgresUrl() {
    return this.cfg.dbReplicaPostgresUrls
  }

  get dbReplicaTags() {
    return this.cfg.dbReplicaTags
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get redisHost() {
    return this.cfg.redisHost
  }

  get redisSentinelName() {
    return this.cfg.redisSentinelName
  }

  get redisSentinelHosts() {
    return this.cfg.redisSentinelHosts
  }

  get redisPassword() {
    return this.cfg.redisPassword
  }

  get didCacheStaleTTL() {
    return this.cfg.didCacheStaleTTL
  }

  get didCacheMaxTTL() {
    return this.cfg.didCacheMaxTTL
  }

  get labelCacheStaleTTL() {
    return this.cfg.labelCacheStaleTTL
  }

  get labelCacheMaxTTL() {
    return this.cfg.labelCacheMaxTTL
  }

  get handleResolveNameservers() {
    return this.cfg.handleResolveNameservers
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get imgUriEndpoint() {
    return this.cfg.imgUriEndpoint
  }

  get blobCacheLocation() {
    return this.cfg.blobCacheLocation
  }

  get searchEndpoint() {
    return this.cfg.searchEndpoint
  }

  get bsyncUrl() {
    return this.cfg.bsyncUrl
  }

  get bsyncApiKey() {
    return this.cfg.bsyncApiKey
  }

  get bsyncOnlyMutes() {
    return this.cfg.bsyncOnlyMutes
  }

  get bsyncHttpVersion() {
    return this.cfg.bsyncHttpVersion
  }

  get bsyncIgnoreBadTls() {
    return this.cfg.bsyncIgnoreBadTls
  }

  get courierUrl() {
    return this.cfg.courierUrl
  }

  get courierApiKey() {
    return this.cfg.courierApiKey
  }

  get courierHttpVersion() {
    return this.cfg.courierHttpVersion
  }

  get courierIgnoreBadTls() {
    return this.cfg.courierIgnoreBadTls
  }

  get courierOnlyRegistration() {
    return this.cfg.courierOnlyRegistration
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

  get modServiceDid() {
    return this.cfg.modServiceDid
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
}

function getTagIdxs(str?: string): number[] {
  return str ? str.split(',').map((item) => parseInt(item, 10)) : []
}

function stripUndefineds(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result = {}
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined) {
      result[key] = val
    }
  })
  return result
}
