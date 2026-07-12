export interface ServerConfigValues {
  port?: number
  publicUrl?: string
  serverDid: string
  alternateAudienceDids: string[]
  dataplaneUrl: string
  didPlcUrl: string
  adminPasswords: string[]
  cdnUrl?: string
  videoPlaylistUrlPattern?: string
  videoThumbnailUrlPattern?: string
  debugMode?: boolean
  environment?: string
}

export class ServerConfig {
  private assignedPort?: number

  constructor(private cfg: ServerConfigValues) {}

  assignPort(port: number) {
    this.assignedPort = port
  }

  get port() {
    return this.assignedPort ?? this.cfg.port ?? 3000
  }

  get publicUrl() {
    return this.cfg.publicUrl ?? `http://localhost:${this.port}`
  }

  get serverDid() {
    return this.cfg.serverDid
  }

  get alternateAudienceDids() {
    return this.cfg.alternateAudienceDids
  }

  get dataplaneUrl() {
    return this.cfg.dataplaneUrl
  }

  get didPlcUrl() {
    return this.cfg.didPlcUrl
  }

  get adminPasswords() {
    return this.cfg.adminPasswords
  }

  get cdnUrl() {
    const configuredCdnUrl = this.cfg.cdnUrl?.trim()
    if (this.environment === 'production' && !configuredCdnUrl) {
      throw new Error('cdnUrl is required in production')
    }

    const cdnUrl = stripTrailingSlashes(
      configuredCdnUrl ?? `${stripTrailingSlashes(this.publicUrl)}/cdn`,
    )
    if (this.environment === 'production') {
      let parsed: URL
      try {
        parsed = new URL(cdnUrl)
      } catch {
        throw new Error('cdnUrl must be a valid HTTPS URL in production')
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('cdnUrl must use HTTPS in production')
      }
      if (isLocalHost(parsed.hostname)) {
        throw new Error('cdnUrl must use a public host in production')
      }
    }
    return cdnUrl
  }

  get videoPlaylistUrlPattern() {
    return (
      this.cfg.videoPlaylistUrlPattern ??
      `${this.publicUrl}/vid/%s/%s/playlist.m3u8`
    )
  }

  get videoThumbnailUrlPattern() {
    return (
      this.cfg.videoThumbnailUrlPattern ??
      `${this.publicUrl}/vid/%s/%s/thumbnail.jpg`
    )
  }

  get debugMode() {
    return this.cfg.debugMode ?? false
  }

  private get environment() {
    return this.cfg.environment ?? process.env.NODE_ENV
  }
}

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '')

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  /^127(?:\.\d{1,3}){3}$/.test(hostname)
