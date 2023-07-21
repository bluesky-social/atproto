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
    const ingesterPartitionCount = overrides?.ingesterPartitionCount
    const ingesterNamespace = overrides?.ingesterNamespace
    const ingesterSubLockId = overrides?.ingesterSubLockId
    assert(dbPostgresUrl)
    assert(redisUrl)
    assert(repoProvider)
    return new IngesterConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisUrl,
      repoProvider,
      ingesterPartitionCount,
      ingesterNamespace,
      ingesterSubLockId,
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
