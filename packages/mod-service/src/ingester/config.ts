import assert from 'assert'

export interface IngesterConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisHost?: string // either set redis host, or both sentinel name and hosts
  redisSentinelName?: string
  redisSentinelHosts?: string[]
  redisPassword?: string
  repoProvider: string
  ingesterPartitionCount: number
  ingesterNamespace?: string
  ingesterSubLockId?: number
  ingesterMaxItems?: number
  ingesterCheckItemsEveryN?: number
  ingesterInitialCursor?: number
}

export class IngesterConfig {
  constructor(private cfg: IngesterConfigValues) {}

  static readEnv(overrides?: Partial<IngesterConfigValues>) {
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
    const repoProvider = overrides?.repoProvider || process.env.REPO_PROVIDER // E.g. ws://abc.com:4000
    const ingesterPartitionCount =
      overrides?.ingesterPartitionCount ||
      maybeParseInt(process.env.INGESTER_PARTITION_COUNT)
    const ingesterSubLockId =
      overrides?.ingesterSubLockId ||
      maybeParseInt(process.env.INGESTER_SUB_LOCK_ID)
    const ingesterMaxItems =
      overrides?.ingesterMaxItems ||
      maybeParseInt(process.env.INGESTER_MAX_ITEMS)
    const ingesterCheckItemsEveryN =
      overrides?.ingesterCheckItemsEveryN ||
      maybeParseInt(process.env.INGESTER_CHECK_ITEMS_EVERY_N)
    const ingesterInitialCursor =
      overrides?.ingesterInitialCursor ||
      maybeParseInt(process.env.INGESTER_INITIAL_CURSOR)
    const ingesterNamespace = overrides?.ingesterNamespace
    assert(dbPostgresUrl)
    assert(redisHost || (redisSentinelName && redisSentinelHosts?.length))
    assert(repoProvider)
    assert(ingesterPartitionCount)
    return new IngesterConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisHost,
      redisSentinelName,
      redisSentinelHosts,
      redisPassword,
      repoProvider,
      ingesterPartitionCount,
      ingesterSubLockId,
      ingesterNamespace,
      ingesterMaxItems,
      ingesterCheckItemsEveryN,
      ingesterInitialCursor,
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

  get repoProvider() {
    return this.cfg.repoProvider
  }

  get ingesterPartitionCount() {
    return this.cfg.ingesterPartitionCount
  }

  get ingesterMaxItems() {
    return this.cfg.ingesterMaxItems
  }

  get ingesterCheckItemsEveryN() {
    return this.cfg.ingesterCheckItemsEveryN
  }

  get ingesterInitialCursor() {
    return this.cfg.ingesterInitialCursor
  }

  get ingesterNamespace() {
    return this.cfg.ingesterNamespace
  }

  get ingesterSubLockId() {
    return this.cfg.ingesterSubLockId
  }
}

function maybeParseInt(str) {
  const parsed = parseInt(str)
  return isNaN(parsed) ? undefined : parsed
}
