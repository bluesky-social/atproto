import assert from 'assert'
import { DAY, HOUR, parseIntWithFallback } from '@atproto/common'

export interface IndexerConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisHost?: string // either set redis host, or both sentinel name and hosts
  redisSentinelName?: string
  redisSentinelHosts?: string[]
  redisPassword?: string
  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number
  handleResolveNameservers?: string[]
  labelerDid: string
  hiveApiKey?: string
  abyssEndpoint?: string
  abyssPassword?: string
  imgUriEndpoint?: string
  labelerKeywords: Record<string, string>
  moderationPushUrl?: string
  indexerConcurrency?: number
  indexerPartitionIds: number[]
  indexerPartitionBatchSize?: number
  indexerSubLockId?: number
  indexerPort?: number
  ingesterPartitionCount: number
  indexerNamespace?: string
  pushNotificationEndpoint?: string
}

export class IndexerConfig {
  constructor(private cfg: IndexerConfigValues) {}

  static readEnv(overrides?: Partial<IndexerConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_PRIMARY_POSTGRES_URL
    const dbPostgresSchema =
      overrides?.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
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
    const handleResolveNameservers = process.env.HANDLE_RESOLVE_NAMESERVERS
      ? process.env.HANDLE_RESOLVE_NAMESERVERS.split(',')
      : []
    const labelerDid = process.env.LABELER_DID || 'did:example:labeler'
    const moderationPushUrl =
      overrides?.moderationPushUrl ||
      process.env.MODERATION_PUSH_URL ||
      undefined
    const hiveApiKey = process.env.HIVE_API_KEY || undefined
    const abyssEndpoint = process.env.ABYSS_ENDPOINT
    const abyssPassword = process.env.ABYSS_PASSWORD
    const imgUriEndpoint = process.env.IMG_URI_ENDPOINT
    const indexerPartitionIds =
      overrides?.indexerPartitionIds ||
      (process.env.INDEXER_PARTITION_IDS
        ? process.env.INDEXER_PARTITION_IDS.split(',').map((n) =>
            parseInt(n, 10),
          )
        : [])
    const indexerPartitionBatchSize = maybeParseInt(
      process.env.INDEXER_PARTITION_BATCH_SIZE,
    )
    const indexerConcurrency = maybeParseInt(process.env.INDEXER_CONCURRENCY)
    const indexerNamespace = overrides?.indexerNamespace
    const indexerSubLockId = maybeParseInt(process.env.INDEXER_SUB_LOCK_ID)
    const indexerPort = maybeParseInt(process.env.INDEXER_PORT)
    const ingesterPartitionCount =
      maybeParseInt(process.env.INGESTER_PARTITION_COUNT) ?? 64
    const labelerKeywords = {}
    const pushNotificationEndpoint = process.env.PUSH_NOTIFICATION_ENDPOINT
    assert(dbPostgresUrl)
    assert(redisHost || (redisSentinelName && redisSentinelHosts?.length))
    assert(indexerPartitionIds.length > 0)
    return new IndexerConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisHost,
      redisSentinelName,
      redisSentinelHosts,
      redisPassword,
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      handleResolveNameservers,
      labelerDid,
      moderationPushUrl,
      hiveApiKey,
      abyssEndpoint,
      abyssPassword,
      imgUriEndpoint,
      indexerPartitionIds,
      indexerConcurrency,
      indexerPartitionBatchSize,
      indexerNamespace,
      indexerSubLockId,
      indexerPort,
      ingesterPartitionCount,
      labelerKeywords,
      pushNotificationEndpoint,
      ...stripUndefineds(overrides ?? {}),
    })
  }

  get version() {
    return this.cfg.version
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
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

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get didCacheStaleTTL() {
    return this.cfg.didCacheStaleTTL
  }

  get didCacheMaxTTL() {
    return this.cfg.didCacheMaxTTL
  }

  get handleResolveNameservers() {
    return this.cfg.handleResolveNameservers
  }

  get labelerDid() {
    return this.cfg.labelerDid
  }

  get moderationPushUrl() {
    return this.cfg.moderationPushUrl
  }

  get hiveApiKey() {
    return this.cfg.hiveApiKey
  }

  get abyssEndpoint() {
    return this.cfg.abyssEndpoint
  }

  get abyssPassword() {
    return this.cfg.abyssPassword
  }

  get imgUriEndpoint() {
    return this.cfg.imgUriEndpoint
  }

  get indexerConcurrency() {
    return this.cfg.indexerConcurrency
  }

  get indexerPartitionIds() {
    return this.cfg.indexerPartitionIds
  }

  get indexerPartitionBatchSize() {
    return this.cfg.indexerPartitionBatchSize
  }

  get indexerNamespace() {
    return this.cfg.indexerNamespace
  }

  get indexerSubLockId() {
    return this.cfg.indexerSubLockId
  }

  get indexerPort() {
    return this.cfg.indexerPort
  }

  get ingesterPartitionCount() {
    return this.cfg.ingesterPartitionCount
  }

  get labelerKeywords() {
    return this.cfg.labelerKeywords
  }

  get pushNotificationEndpoint() {
    return this.cfg.pushNotificationEndpoint
  }
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

function maybeParseInt(str) {
  const parsed = parseInt(str)
  return isNaN(parsed) ? undefined : parsed
}
