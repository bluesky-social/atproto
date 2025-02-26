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
  etcdHosts: string[]
  dataplaneUrls: string[]
  dataplaneUrlsEtcdKeyPrefix?: string
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
  topicsUrl?: string
  topicsApiKey?: string
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
  // threads
  bigThreadUris: Set<string>
  bigThreadDepth?: number
  maxThreadDepth?: number
  // notifications
  notificationsDelayMs?: number
  // client config
  clientCheckEmailConfirmed?: boolean
  topicsEnabled?: boolean
  // http proxy agent
  disableSsrfProtection?: boolean
  proxyAllowHTTP2?: boolean
  proxyHeadersTimeout?: number
  proxyBodyTimeout?: number
  proxyMaxResponseSize?: number
  proxyMaxRetries?: number
  proxyPreferCompressed?: boolean
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || undefined
    const debugMode =
      // Because security related features are disabled in development mode, this requires explicit opt-in.
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    const publicUrl = process.env.BSKY_PUBLIC_URL || undefined
    const serverDid = process.env.BSKY_SERVER_DID || 'did:example:test'
    const envPort = parseInt(process.env.BSKY_PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const didPlcUrl = process.env.BSKY_DID_PLC_URL || 'http://localhost:2582'
    const alternateAudienceDids = envList(process.env.BSKY_ALT_AUDIENCE_DIDS)
    const entrywayJwtPublicKeyHex =
      process.env.BSKY_ENTRYWAY_JWT_PUBLIC_KEY_HEX || undefined
    const handleResolveNameservers = envList(
      process.env.BSKY_HANDLE_RESOLVE_NAMESERVERS,
    )
    const cdnUrl = process.env.BSKY_CDN_URL || process.env.BSKY_IMG_URI_ENDPOINT
    const etcdHosts =
      overrides?.etcdHosts ?? envList(process.env.BSKY_ETCD_HOSTS)
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
    const topicsUrl = process.env.BSKY_TOPICS_URL || undefined
    const topicsApiKey = process.env.BSKY_TOPICS_API_KEY
    const dataplaneUrls =
      overrides?.dataplaneUrls ?? envList(process.env.BSKY_DATAPLANE_URLS)
    const dataplaneUrlsEtcdKeyPrefix =
      process.env.BSKY_DATAPLANE_URLS_ETCD_KEY_PREFIX || undefined
    const dataplaneHttpVersion = process.env.BSKY_DATAPLANE_HTTP_VERSION || '2'
    const dataplaneIgnoreBadTls =
      process.env.BSKY_DATAPLANE_IGNORE_BAD_TLS === 'true'
    assert(
      !dataplaneUrlsEtcdKeyPrefix || etcdHosts.length,
      'etcd prefix for dataplane urls may only be configured when there are etcd hosts',
    )
    assert(
      dataplaneUrls.length || dataplaneUrlsEtcdKeyPrefix,
      'dataplane urls are not configured directly nor with etcd',
    )
    assert(dataplaneHttpVersion === '1.1' || dataplaneHttpVersion === '2')
    const labelsFromIssuerDids = envList(
      process.env.BSKY_LABELS_FROM_ISSUER_DIDS,
    )
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
    const topicsEnabled = process.env.BSKY_TOPICS_ENABLED === 'true'
    const indexedAtEpoch = process.env.BSKY_INDEXED_AT_EPOCH
      ? new Date(process.env.BSKY_INDEXED_AT_EPOCH)
      : undefined
    assert(
      !indexedAtEpoch || !isNaN(indexedAtEpoch.getTime()),
      'invalid BSKY_INDEXED_AT_EPOCH',
    )
    const bigThreadUris = new Set(envList(process.env.BSKY_BIG_THREAD_URIS))
    const bigThreadDepth = process.env.BSKY_BIG_THREAD_DEPTH
      ? parseInt(process.env.BSKY_BIG_THREAD_DEPTH || '', 10)
      : undefined
    const maxThreadDepth = process.env.BSKY_MAX_THREAD_DEPTH
      ? parseInt(process.env.BSKY_MAX_THREAD_DEPTH || '', 10)
      : undefined

    const notificationsDelayMs = process.env.BSKY_NOTIFICATIONS_DELAY_MS
      ? parseInt(process.env.BSKY_NOTIFICATIONS_DELAY_MS || '', 10)
      : 0

    const disableSsrfProtection = process.env.BSKY_DISABLE_SSRF_PROTECTION
      ? process.env.BSKY_DISABLE_SSRF_PROTECTION === 'true'
      : debugMode

    const proxyAllowHTTP2 = process.env.BSKY_PROXY_ALLOW_HTTP2 === 'true'
    const proxyHeadersTimeout =
      parseInt(process.env.BSKY_PROXY_HEADERS_TIMEOUT || '', 10) || undefined
    const proxyBodyTimeout =
      parseInt(process.env.BSKY_PROXY_BODY_TIMEOUT || '', 10) || undefined
    const proxyMaxResponseSize =
      parseInt(process.env.BSKY_PROXY_MAX_RESPONSE_SIZE || '', 10) || undefined
    const proxyMaxRetries =
      parseInt(process.env.BSKY_PROXY_MAX_RETRIES || '', 10) || undefined
    const proxyPreferCompressed =
      process.env.BSKY_PROXY_PREFER_COMPRESSED === 'true'

    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      serverDid,
      alternateAudienceDids,
      entrywayJwtPublicKeyHex,
      etcdHosts,
      dataplaneUrls,
      dataplaneUrlsEtcdKeyPrefix,
      dataplaneHttpVersion,
      dataplaneIgnoreBadTls,
      searchUrl,
      suggestionsUrl,
      suggestionsApiKey,
      topicsUrl,
      topicsApiKey,
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
      topicsEnabled,
      indexedAtEpoch,
      bigThreadUris,
      bigThreadDepth,
      maxThreadDepth,
      notificationsDelayMs,
      disableSsrfProtection,
      proxyAllowHTTP2,
      proxyHeadersTimeout,
      proxyBodyTimeout,
      proxyMaxResponseSize,
      proxyMaxRetries,
      proxyPreferCompressed,
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

  get etcdHosts() {
    return this.cfg.etcdHosts
  }

  get dataplaneUrlsEtcdKeyPrefix() {
    return this.cfg.dataplaneUrlsEtcdKeyPrefix
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

  get topicsUrl() {
    return this.cfg.topicsUrl
  }

  get topicsApiKey() {
    return this.cfg.topicsApiKey
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

  get topicsEnabled() {
    return this.cfg.topicsEnabled
  }

  get indexedAtEpoch() {
    return this.cfg.indexedAtEpoch
  }

  get bigThreadUris() {
    return this.cfg.bigThreadUris
  }

  get bigThreadDepth() {
    return this.cfg.bigThreadDepth
  }

  get maxThreadDepth() {
    return this.cfg.maxThreadDepth
  }

  get notificationsDelayMs() {
    return this.cfg.notificationsDelayMs ?? 0
  }

  get disableSsrfProtection(): boolean {
    return this.cfg.disableSsrfProtection ?? false
  }

  get proxyAllowHTTP2(): boolean {
    return this.cfg.proxyAllowHTTP2 ?? false
  }

  get proxyHeadersTimeout(): number {
    return this.cfg.proxyHeadersTimeout ?? 30e3
  }

  get proxyBodyTimeout(): number {
    return this.cfg.proxyBodyTimeout ?? 30e3
  }

  get proxyMaxResponseSize(): number {
    return this.cfg.proxyMaxResponseSize ?? 10 * 1024 * 1024 // 10mb
  }

  get proxyMaxRetries(): number {
    return this.cfg.proxyMaxRetries ?? 3
  }

  get proxyPreferCompressed(): boolean {
    return this.cfg.proxyPreferCompressed ?? true
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
