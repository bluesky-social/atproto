import assert from 'assert'
import { DAY, HOUR, parseIntWithFallback } from '@atproto/common'

export interface IndexerConfigValues {
  version: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  redisUrl: string
  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number
  labelerDid: string
  hiveApiKey?: string
  labelerKeywords: Record<string, string>
  indexerConcurrency?: number
  indexerPartitionNames: string[]
  indexerSubLockId?: number
}

export class IndexerConfig {
  constructor(private cfg: IndexerConfigValues) {}

  static readEnv(overrides?: Partial<IndexerConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_POSTGRES_URL
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA
    const redisUrl = overrides?.redisUrl || process.env.REDIS_URL
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )
    const labelerDid = process.env.LABELER_DID || 'did:example:labeler'
    const hiveApiKey = process.env.HIVE_API_KEY || undefined
    const indexerPartitionNames = process.env.INDEXER_PARTITION_NAMES
      ? process.env.INDEXER_PARTITION_NAMES.split(',')
      : []
    const indexerConcurrency = maybeParseInt(process.env.INDEXER_CONCURRENCY)
    const indexerSubLockId = maybeParseInt(process.env.INDEXER_SUB_LOCK_ID)
    const labelerKeywords = {}
    assert(dbPostgresUrl)
    assert(redisUrl)
    return new IndexerConfig({
      version,
      dbPostgresUrl,
      dbPostgresSchema,
      redisUrl,
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      labelerDid,
      hiveApiKey,
      indexerPartitionNames,
      indexerConcurrency,
      indexerSubLockId,
      labelerKeywords,
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

  get redisUrl() {
    return this.cfg.redisUrl
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

  get labelerDid() {
    return this.cfg.labelerDid
  }

  get hiveApiKey() {
    return this.cfg.hiveApiKey
  }

  get indexerConcurrency() {
    return this.cfg.indexerConcurrency
  }

  get indexerPartitionNames() {
    return this.cfg.indexerPartitionNames
  }

  get indexerSubLockId() {
    return this.cfg.indexerSubLockId
  }

  get labelerKeywords() {
    return this.cfg.labelerKeywords
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
