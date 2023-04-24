import assert from 'assert'

export interface ServerConfigValues {
  version: string
  debugMode?: boolean
  port?: number
  publicUrl?: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  didPlcUrl: string
  imgUriSalt: string
  imgUriKey: string
  imgUriEndpoint?: string
  blobCacheLocation?: string
  repoProvider?: string
  repoSubLockId?: number
  labelerDid: string
  hiveApiKey?: string
  adminPassword: string
  labelerKeywords: Record<string, string>
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const debugMode = process.env.NODE_ENV !== 'production'
    const publicUrl = process.env.PUBLIC_URL || undefined
    const envPort = parseInt(process.env.PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const imgUriSalt =
      process.env.IMG_URI_SALT || '9dd04221f5755bce5f55f47464c27e1e'
    const imgUriKey =
      process.env.IMG_URI_KEY ||
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8'
    const imgUriEndpoint = process.env.IMG_URI_ENDPOINT
    const blobCacheLocation = process.env.BLOB_CACHE_LOC
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl)
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA
    const repoProvider = process.env.REPO_PROVIDER // E.g. ws://abc.com:4000
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const labelerDid = process.env.LABELER_DID || 'did:example:labeler'
    const hiveApiKey = process.env.HIVE_API_KEY || undefined
    const labelerKeywords = {}
    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      dbPostgresUrl,
      dbPostgresSchema,
      didPlcUrl,
      imgUriSalt,
      imgUriKey,
      imgUriEndpoint,
      blobCacheLocation,
      repoProvider,
      labelerDid,
      hiveApiKey,
      adminPassword,
      labelerKeywords,
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

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get imgUriSalt() {
    return this.cfg.imgUriSalt
  }

  get imgUriKey() {
    return this.cfg.imgUriKey
  }

  get imgUriEndpoint() {
    return this.cfg.imgUriEndpoint
  }

  get blobCacheLocation() {
    return this.cfg.blobCacheLocation
  }

  get repoProvider() {
    return this.cfg.repoProvider
  }

  get repoSubLockId() {
    return this.cfg.repoSubLockId
  }

  get labelerDid() {
    return this.cfg.labelerDid
  }

  get hiveApiKey() {
    return this.cfg.hiveApiKey
  }

  get labelerKeywords() {
    return this.cfg.labelerKeywords
  }

  get adminPassword() {
    return this.cfg.adminPassword
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
