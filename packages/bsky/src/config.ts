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
  searchEndpoint?: string
  didPlcUrl: string
  labelsFromIssuerDids?: string[]
  handleResolveNameservers?: string[]
  imgUriEndpoint?: string
  blobCacheLocation?: string
  bsyncUrl: string
  bsyncApiKey?: string
  bsyncHttpVersion?: '1.1' | '2'
  bsyncIgnoreBadTls?: boolean
  courierUrl: string
  courierApiKey?: string
  courierHttpVersion?: '1.1' | '2'
  courierIgnoreBadTls?: boolean
  adminPassword: string
  moderatorPassword: string
  triagePassword: string
  modServiceDid: string
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
    const searchEndpoint = process.env.BSKY_SEARCH_ENDPOINT || undefined
    let dataplaneUrls = overrides?.dataplaneUrls
    dataplaneUrls ??= process.env.BSKY_DATAPLANE_URLS
      ? process.env.BSKY_DATAPLANE_URLS.split(',')
      : []
    const dataplaneHttpVersion = process.env.BSKY_DATAPLANE_HTTP_VERSION || '2'
    const dataplaneIgnoreBadTls =
      process.env.BSKY_DATAPLANE_IGNORE_BAD_TLS === 'true'
    const labelsFromIssuerDids = process.env.BSKY_LABELS_FROM_ISSUER_DIDS
      ? process.env.BSKY_LABELS_FROM_ISSUER_DIDS.split(',')
      : []
    const bsyncUrl = process.env.BSKY_BSYNC_URL || undefined
    assert(bsyncUrl)
    const bsyncApiKey = process.env.BSKY_BSYNC_API_KEY || undefined
    const bsyncHttpVersion = process.env.BSKY_BSYNC_HTTP_VERSION || '2'
    const bsyncIgnoreBadTls = process.env.BSKY_BSYNC_IGNORE_BAD_TLS === 'true'
    assert(bsyncHttpVersion === '1.1' || bsyncHttpVersion === '2')
    const courierUrl = process.env.BSKY_COURIER_URL || undefined
    assert(courierUrl)
    const courierApiKey = process.env.BSKY_COURIER_API_KEY || undefined
    const courierHttpVersion = process.env.BSKY_COURIER_HTTP_VERSION || '2'
    const courierIgnoreBadTls =
      process.env.BSKY_COURIER_IGNORE_BAD_TLS === 'true'
    assert(courierHttpVersion === '1.1' || courierHttpVersion === '2')
    const adminPassword = process.env.ADMIN_PASSWORD || undefined
    assert(adminPassword)
    const moderatorPassword = process.env.BSKY_MODERATOR_PASSWORD
    assert(moderatorPassword)
    const triagePassword = process.env.BSKY_TRIAGE_PASSWORD
    assert(triagePassword)
    const modServiceDid = process.env.MOD_SERVICE_DID
    assert(modServiceDid)
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
      searchEndpoint,
      didPlcUrl,
      labelsFromIssuerDids,
      handleResolveNameservers,
      imgUriEndpoint,
      blobCacheLocation,
      bsyncUrl,
      bsyncApiKey,
      bsyncHttpVersion,
      bsyncIgnoreBadTls,
      courierUrl,
      courierApiKey,
      courierHttpVersion,
      courierIgnoreBadTls,
      adminPassword,
      moderatorPassword,
      triagePassword,
      modServiceDid,
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

  get labelsFromIssuerDids() {
    return this.cfg.labelsFromIssuerDids ?? []
  }

  get searchEndpoint() {
    return this.cfg.searchEndpoint
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

  get bsyncUrl() {
    return this.cfg.bsyncUrl
  }

  get bsyncApiKey() {
    return this.cfg.bsyncApiKey
  }

  get bsyncHttpVersion() {
    return this.cfg.bsyncHttpVersion
  }

  get bsyncIgnoreBadTls() {
    return this.cfg.bsyncIgnoreBadTls
  }

  get courierUrl() {
    return this.cfg.courierUrl
  }

  get courierApiKey() {
    return this.cfg.courierApiKey
  }

  get courierHttpVersion() {
    return this.cfg.courierHttpVersion
  }

  get courierIgnoreBadTls() {
    return this.cfg.courierIgnoreBadTls
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

  get modServiceDid() {
    return this.cfg.modServiceDid
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
