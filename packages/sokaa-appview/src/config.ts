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
    return this.cfg.cdnUrl ?? `${this.publicUrl}/cdn`
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
}
