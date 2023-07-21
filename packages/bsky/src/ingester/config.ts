import assert from 'assert'

export interface IngesterConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisUrl: string
  repoProvider: string
  ingesterPartitionCount?: number
  ingesterNamespace?: string
  ingesterSubLockId?: number
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
