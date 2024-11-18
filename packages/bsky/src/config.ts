import assert from 'node:assert'

export interface ServerConfigValues {
  // service
  version?: string
  debugMode?: boolean
  port?: number
  publicUrl?: string
  serverDid: string
  alternateAudienceDids: string[]
  entrywayJwtPublicKeyHex?: string
  // external services
  dataplaneUrls: string[]
  dataplaneHttpVersion?: '1.1' | '2'
  dataplaneIgnoreBadTls?: boolean
  bsyncUrl: string
  bsyncApiKey?: string
  bsyncHttpVersion?: '1.1' | '2'
  bsyncIgnoreBadTls?: boolean
  courierUrl?: string
  courierApiKey?: string
  courierHttpVersion?: '1.1' | '2'
  courierIgnoreBadTls?: boolean
  searchUrl?: string
  suggestionsUrl?: string
  suggestionsApiKey?: string
  cdnUrl?: string
  videoPlaylistUrlPattern?: string
  videoThumbnailUrlPattern?: string
  blobRateLimitBypassKey?: string
  blobRateLimitBypassHostname?: string
  // identity
  didPlcUrl: string
  handleResolveNameservers?: string[]
  // moderation and administration
  modServiceDid: string
  adminPasswords: string[]
  labelsFromIssuerDids?: string[]
  indexedAtEpoch?: Date
  // misc/dev
  blobCacheLocation?: string
  statsigKey?: string
  statsigEnv?: string
  // client config
  clientCheckEmailConfirmed?: boolean
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || undefined
    const debugMode = process.env.NODE_ENV !== 'production'
    const publicUrl = process.env.BSKY_PUBLIC_URL || undefined
    const serverDid = process.env.BSKY_SERVER_DID || 'did:example:test'
    const envPort = parseInt(process.env.BSKY_PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const didPlcUrl = process.env.BSKY_DID_PLC_URL || 'http://localhost:2582'
    const alternateAudienceDids = process.env.BSKY_ALT_AUDIENCE_DIDS
      ? process.env.BSKY_ALT_AUDIENCE_DIDS.split(',')
      : []
    const entrywayJwtPublicKeyHex =
      process.env.BSKY_ENTRYWAY_JWT_PUBLIC_KEY_HEX || undefined
    const handleResolveNameservers = process.env.BSKY_HANDLE_RESOLVE_NAMESERVERS
      ? process.env.BSKY_HANDLE_RESOLVE_NAMESERVERS.split(',')
      : []
    const cdnUrl = process.env.BSKY_CDN_URL || process.env.BSKY_IMG_URI_ENDPOINT
    // e.g. https://video.invalid/watch/%s/%s/playlist.m3u8
    const videoPlaylistUrlPattern = process.env.BSKY_VIDEO_PLAYLIST_URL_PATTERN
    // e.g. https://video.invalid/watch/%s/%s/thumbnail.jpg
    const videoThumbnailUrlPattern =
      process.env.BSKY_VIDEO_THUMBNAIL_URL_PATTERN
    const blobCacheLocation = process.env.BSKY_BLOB_CACHE_LOC
    const searchUrl =
      process.env.BSKY_SEARCH_URL ||
      process.env.BSKY_SEARCH_ENDPOINT ||
      undefined
    const suggestionsUrl = process.env.BSKY_SUGGESTIONS_URL || undefined
    const suggestionsApiKey = process.env.BSKY_SUGGESTIONS_API_KEY || undefined
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
    const courierApiKey = process.env.BSKY_COURIER_API_KEY || undefined
    const courierHttpVersion = process.env.BSKY_COURIER_HTTP_VERSION || '2'
    const courierIgnoreBadTls =
      process.env.BSKY_COURIER_IGNORE_BAD_TLS === 'true'
    assert(courierHttpVersion === '1.1' || courierHttpVersion === '2')
    const blobRateLimitBypassKey =
      process.env.BSKY_BLOB_RATE_LIMIT_BYPASS_KEY || undefined
    // single domain would be e.g. "mypds.com", subdomains are supported with a leading dot e.g. ".mypds.com"
    const blobRateLimitBypassHostname =
      process.env.BSKY_BLOB_RATE_LIMIT_BYPASS_HOSTNAME || undefined
    assert(
      !blobRateLimitBypassKey || blobRateLimitBypassHostname,
      'must specify a hostname when using a blob rate limit bypass key',
    )
    const adminPasswords = envList(
      process.env.BSKY_ADMIN_PASSWORDS || process.env.BSKY_ADMIN_PASSWORD,
    )
    const modServiceDid = process.env.MOD_SERVICE_DID
    assert(modServiceDid)
    assert(dataplaneUrls.length)
    assert(dataplaneHttpVersion === '1.1' || dataplaneHttpVersion === '2')
    const statsigKey =
      process.env.NODE_ENV === 'test'
        ? 'secret-key'
        : process.env.BSKY_STATSIG_KEY || undefined
    const statsigEnv =
      process.env.NODE_ENV === 'test'
        ? 'test'
        : process.env.BSKY_STATSIG_ENV || 'development'
    const clientCheckEmailConfirmed =
      process.env.BSKY_CLIENT_CHECK_EMAIL_CONFIRMED === 'true'
    const indexedAtEpoch = process.env.BSKY_INDEXED_AT_EPOCH
      ? new Date(process.env.BSKY_INDEXED_AT_EPOCH)
      : undefined
    assert(
      !indexedAtEpoch || !isNaN(indexedAtEpoch.getTime()),
      'invalid BSKY_INDEXED_AT_EPOCH',
    )
    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      serverDid,
      alternateAudienceDids,
      entrywayJwtPublicKeyHex,
      dataplaneUrls,
      dataplaneHttpVersion,
      dataplaneIgnoreBadTls,
      searchUrl,
      suggestionsUrl,
      suggestionsApiKey,
      didPlcUrl,
      labelsFromIssuerDids,
      handleResolveNameservers,
      cdnUrl,
      videoPlaylistUrlPattern,
      videoThumbnailUrlPattern,
      blobCacheLocation,
      bsyncUrl,
      bsyncApiKey,
      bsyncHttpVersion,
      bsyncIgnoreBadTls,
      courierUrl,
      courierApiKey,
      courierHttpVersion,
      courierIgnoreBadTls,
      blobRateLimitBypassKey,
      blobRateLimitBypassHostname,
      adminPasswords,
      modServiceDid,
      statsigKey,
      statsigEnv,
      clientCheckEmailConfirmed,
      indexedAtEpoch,
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

  get alternateAudienceDids() {
    return this.cfg.alternateAudienceDids
  }

  get entrywayJwtPublicKeyHex() {
    return this.cfg.entrywayJwtPublicKeyHex
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

  get searchUrl() {
    return this.cfg.searchUrl
  }

  get suggestionsUrl() {
    return this.cfg.suggestionsUrl
  }

  get suggestionsApiKey() {
    return this.cfg.suggestionsApiKey
  }

  get cdnUrl() {
    return this.cfg.cdnUrl
  }

  get videoPlaylistUrlPattern() {
    return this.cfg.videoPlaylistUrlPattern
  }

  get videoThumbnailUrlPattern() {
    return this.cfg.videoThumbnailUrlPattern
  }

  get blobRateLimitBypassKey() {
    return this.cfg.blobRateLimitBypassKey
  }

  get blobRateLimitBypassHostname() {
    return this.cfg.blobRateLimitBypassHostname
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get handleResolveNameservers() {
    return this.cfg.handleResolveNameservers
  }

  get adminPasswords() {
    return this.cfg.adminPasswords
  }

  get modServiceDid() {
    return this.cfg.modServiceDid
  }

  get labelsFromIssuerDids() {
    return this.cfg.labelsFromIssuerDids ?? []
  }

  get blobCacheLocation() {
    return this.cfg.blobCacheLocation
  }

  get statsigKey() {
    return this.cfg.statsigKey
  }

  get statsigEnv() {
    return this.cfg.statsigEnv
  }

  get clientCheckEmailConfirmed() {
    return this.cfg.clientCheckEmailConfirmed
  }

  get indexedAtEpoch() {
    return this.cfg.indexedAtEpoch
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

function envList(str: string | undefined): string[] {
  if (str === undefined || str.length === 0) return []
  return str.split(',')
}
