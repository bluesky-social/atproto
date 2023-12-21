import assert from 'assert'

export interface ServerConfigValues {
  version: string
  debugMode?: boolean
  port?: number
  publicUrl?: string
  serverDid: string
  appviewUrl: string
  dbPostgresUrl: string
  dbPostgresSchema?: string
  didPlcUrl: string
  labelerDid: string
  adminPassword: string
  moderatorPassword?: string
  triagePassword?: string
  moderationPushUrl?: string
}

export class ServerConfig {
  private assignedPort?: number
  constructor(private cfg: ServerConfigValues) {}

  static readEnv(overrides?: Partial<ServerConfigValues>) {
    const version = process.env.BSKY_VERSION || '0.0.0'
    const debugMode = process.env.NODE_ENV !== 'production'
    const publicUrl = process.env.PUBLIC_URL || undefined
    const serverDid = process.env.SERVER_DID || 'did:example:test'
    const envPort = parseInt(process.env.PORT || '', 10)
    const port = isNaN(envPort) ? 2584 : envPort
    const appviewUrl = process.env.APPVIEW_URL
    assert(appviewUrl)
    const dbPostgresUrl =
      overrides?.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl)
    const dbPostgresSchema = process.env.DB_POSTGRES_SCHEMA
    const didPlcUrl = process.env.DID_PLC_URL || 'http://localhost:2582'
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
    const moderatorPassword = process.env.MODERATOR_PASSWORD || undefined
    const triagePassword = process.env.TRIAGE_PASSWORD || undefined
    const labelerDid = process.env.LABELER_DID || 'did:example:labeler'
    const moderationPushUrl =
      overrides?.moderationPushUrl ||
      process.env.MODERATION_PUSH_URL ||
      undefined

    return new ServerConfig({
      version,
      debugMode,
      port,
      publicUrl,
      serverDid,
      appviewUrl,
      dbPostgresUrl,
      dbPostgresSchema,
      didPlcUrl,
      labelerDid,
      adminPassword,
      moderatorPassword,
      triagePassword,
      moderationPushUrl,
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

  get appviewUrl() {
    return this.cfg.appviewUrl
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

  get moderationPushUrl() {
    return this.cfg.moderationPushUrl
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
