import assert from 'assert'

export interface IngesterConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisUrl: string
  repoProvider: string
  ingesterPartitionCount: number
  ingesterNamespace?: string
  ingesterSubLockId?: number
  ingesterMaxItems?: number
  ingesterCheckItemsEveryN?: number
}

export class IngesterConfig {
  constructor(private cfg: IngesterConfigValues) {}

  static readEnv(overrides?: Partial<IngesterConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_POSTGRES_URL
    const dbPostgresSchema =
      overrides?.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
    const redisUrl = overrides?.redisUrl || process.env.REDIS_URL
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
    const ingesterNamespace = overrides?.ingesterNamespace
    assert(dbPostgresUrl)
    assert(redisUrl)
    assert(repoProvider)
    assert(ingesterPartitionCount)
    return new IngesterConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisUrl,
      repoProvider,
      ingesterPartitionCount,
      ingesterSubLockId,
      ingesterNamespace,
      ingesterMaxItems,
      ingesterCheckItemsEveryN,
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

  get redisUrl() {
    return this.cfg.redisUrl
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
