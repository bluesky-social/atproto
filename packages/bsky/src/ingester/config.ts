import assert from 'assert'

export interface IngesterConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisUrl: string
  repoProvider: string
  repoSubLockId?: number
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
    const repoSubLockId = overrides?.repoSubLockId
    assert(dbPostgresUrl)
    assert(redisUrl)
    assert(repoProvider)
    return new IngesterConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisUrl,
      repoProvider,
      repoSubLockId,
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

  get repoSubLockId() {
    return this.cfg.repoSubLockId
  }
}
