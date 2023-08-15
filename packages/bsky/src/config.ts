import assert from 'assert'
import { DAY, HOUR, parseIntWithFallback } from '@atproto/common'

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
  didPlcUrl: string
  didCacheStaleTTL: number
  didCacheMaxTTL: number
  imgUriEndpoint?: string
  blobCacheLocation?: string
  labelerDid: string
  adminPassword: string
  moderatorPassword?: string
  triagePassword?: string
  moderationActionReverseUrl?: string
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
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const didCacheStaleTTL = parseIntWithFallback(
      process.env.DID_CACHE_STALE_TTL,
      HOUR,
    )
    const didCacheMaxTTL = parseIntWithFallback(
      process.env.DID_CACHE_MAX_TTL,
      DAY,
    )
    const imgUriEndpoint = process.env.IMG_URI_ENDPOINT
    const blobCacheLocation = process.env.BLOB_CACHE_LOC
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
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined
    const triagePassword = process.env.TRIAGE_PASSWORD || undefined
    const labelerDid = process.env.LABELER_DID || 'did:example:labeler'
    const moderationActionReverseUrl =
      overrides?.moderationActionReverseUrl ||
      process.env.MODERATION_PUSH_URL ||
      undefined
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
      didPlcUrl,
      didCacheStaleTTL,
      didCacheMaxTTL,
      imgUriEndpoint,
      blobCacheLocation,
      labelerDid,
      adminPassword,
      moderatorPassword,
      triagePassword,
      moderationActionReverseUrl,
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

  get didCacheStaleTTL() {
    return this.cfg.didCacheStaleTTL
  }

  get didCacheMaxTTL() {
    return this.cfg.didCacheStaleTTL
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

  get labelerDid() {
    return this.cfg.labelerDid
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

  get moderationActionReverseUrl() {
    return this.cfg.moderationActionReverseUrl
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
