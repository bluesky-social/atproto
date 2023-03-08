import assert from 'assert'

export interface ServerConfigValues {
  debugMode?: boolean
  version: string
  publicUrl?: string
  scheme: string
  port?: number
  hostname: string
  dbPostgresUrl?: string
  dbPostgresSchema?: string
  blobstoreLocation?: string
  blobstoreTmp?: string
  didPlcUrl: string
  imgUriSalt: string
  imgUriKey: string
  imgUriEndpoint?: string
  blobCacheLocation?: string
  repoProvider: string
}

export class ServerConfig {
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const debugMode = process.env.DEBUG_MODE === '1'
    const version = process.env.BSKY_VERSION || '0.0.0'
    const publicUrl = process.env.PUBLIC_URL || undefined
    const hostname = process.env.HOSTNAME || 'localhost'
    let scheme
    if ('TLS' in process.env) {
      scheme = process.env.TLS === '1' ? 'https' : 'http'
    } else {
      scheme = hostname === 'localhost' ? 'http' : 'https'
    }
    const envPort = parseInt(process.env.PORT || '', 10)
    const port = isNaN(envPort) ? 2583 : envPort
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const blobstoreLocation = process.env.BLOBSTORE_LOC
    const blobstoreTmp = process.env.BLOBSTORE_TMP
    const imgUriSalt =
      process.env.IMG_URI_SALT || '9dd04221f5755bce5f55f47464c27e1e'
    const imgUriKey =
      process.env.IMG_URI_KEY ||
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8'
    const imgUriEndpoint = process.env.IMG_URI_ENDPOINT
    const blobCacheLocation = process.env.BLOB_CACHE_LOC
    const dbPostgresUrl = process.env.DB_POSTGRES_URL
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA
    const repoProvider = process.env.REPO_PROVIDER // E.g. ws://abc.com:4000
    assert(repoProvider)
    return new ServerConfig({
      debugMode,
      version,
      publicUrl,
      scheme,
      hostname,
      port,
      dbPostgresUrl,
      dbPostgresSchema,
      blobstoreLocation,
      blobstoreTmp,
      didPlcUrl,
      imgUriSalt,
      imgUriKey,
      imgUriEndpoint,
      blobCacheLocation,
      repoProvider,
      ...overrides,
    })
  }

  get debugMode() {
    return this.cfg.debugMode
  }

  get version() {
    return this.cfg.version
  }

  get scheme() {
    return this.cfg.scheme
  }

  get port() {
    return this.cfg.port
  }

  get hostname() {
    return this.cfg.hostname
  }

  get internalUrl() {
    return `${this.scheme}://${this.hostname}:${this.port}`
  }

  get origin() {
    const u = new URL(this.internalUrl)
    return u.origin
  }

  get publicUrl() {
    return this.cfg.publicUrl || this.internalUrl
  }

  get publicHostname() {
    const u = new URL(this.publicUrl)
    return u.hostname
  }

  get dbPostgresUrl() {
    return this.cfg.dbPostgresUrl
  }

  get dbPostgresSchema() {
    return this.cfg.dbPostgresSchema
  }

  get blobstoreLocation() {
    return this.cfg.blobstoreLocation
  }

  get blobstoreTmp() {
    return this.cfg.blobstoreTmp
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
}
