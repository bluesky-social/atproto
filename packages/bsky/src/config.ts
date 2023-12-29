import assert from 'assert'

export interface ServerConfigValues {
  version?: string
  debugMode?: boolean
  port?: number
  publicUrl?: string
  serverDid: string
  feedGenDid?: string
  dataplaneUrls: string[]
  dataplaneHttpVersion?: '1.1' | '2'
  dataplaneIgnoreBadTls?: boolean
  didPlcUrl: string
  handleResolveNameservers?: string[]
  imgUriEndpoint?: string
  blobCacheLocation?: string
  adminPassword: string
  moderatorPassword?: string
  triagePassword?: string
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || undefined
    const debugMode = process.env.NODE_ENV !== 'production'
    const publicUrl = process.env.BSKY_PUBLIC_URL || undefined
    const serverDid = process.env.BSKY_SERVER_DID || 'did:example:test'
    const feedGenDid = process.env.BSKY_FEED_GEN_DID
    const envPort = parseInt(process.env.BSKY_PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const didPlcUrl = process.env.BSKY_DID_PLC_URL || 'http://localhost:2582'
    const handleResolveNameservers = process.env.BSKY_HANDLE_RESOLVE_NAMESERVERS
      ? process.env.BSKY_HANDLE_RESOLVE_NAMESERVERS.split(',')
      : []
    const imgUriEndpoint = process.env.BSKY_IMG_URI_ENDPOINT
    const blobCacheLocation = process.env.BSKY_BLOB_CACHE_LOC
    let dataplaneUrls = overrides?.dataplaneUrls
    dataplaneUrls ??= process.env.BSKY_DATAPLANE_URLS
      ? process.env.BSKY_DATAPLANE_URLS.split(',')
      : []
    const dataplaneHttpVersion = process.env.BSKY_DATAPLANE_HTTP_VERSION || '2'
    const dataplaneIgnoreBadTls =
      process.env.BSKY_DATAPLANE_IGNORE_BAD_TLS === 'true'
    const adminPassword = process.env.BSKY_ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.BSKY_MODERATOR_PASSWORD || undefined
    const triagePassword = process.env.BSKY_TRIAGE_PASSWORD || undefined
    assert(dataplaneUrls.length)
    assert(dataplaneHttpVersion === '1.1' || dataplaneHttpVersion === '2')
    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      serverDid,
      feedGenDid,
      dataplaneUrls,
      dataplaneHttpVersion,
      dataplaneIgnoreBadTls,
      didPlcUrl,
      handleResolveNameservers,
      imgUriEndpoint,
      blobCacheLocation,
      adminPassword,
      moderatorPassword,
      triagePassword,
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

  get dataplaneUrls() {
    return this.cfg.dataplaneUrls
  }

  get dataplaneHttpVersion() {
    return this.cfg.dataplaneHttpVersion
  }

  get dataplaneIgnoreBadTls() {
    return this.cfg.dataplaneIgnoreBadTls
  }

  get handleResolveNameservers() {
    return this.cfg.handleResolveNameservers
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

  get adminPassword() {
    return this.cfg.adminPassword
  }

  get moderatorPassword() {
    return this.cfg.moderatorPassword
  }

  get triagePassword() {
    return this.cfg.triagePassword
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
